import { supabase, Asset, RoundState, Database } from './supabase'
import { getReconciledPrice } from './oracle'
import { creditPoints } from './ledger'
import { getStreakMultiplier, updateStreakAfterSettlement } from './streak'
import { activateReferralIfPending, applyDownlineOverride } from './referral'

type Round = Database['public']['Tables']['rounds']['Row']
type Prediction = Database['public']['Tables']['predictions']['Row']

const ASSETS: Asset[] = ['BTC', 'ETH', 'TON']
const HOURLY_BASE_REWARD = 100
const MAIN_DAILY_BASE_REWARD = 500
const PREDICTION_CLOSE_BUFFER_MIN = 5

async function getActiveSeasonId(): Promise<number> {
  const { data, error } = await supabase.from('seasons').select('id').eq('is_active', true).limit(1).single()
  if (error || !data) throw new Error('No active season found')
  return data.id
}

async function ensureRoundExists(
  seasonId: number,
  asset: Asset,
  kind: 'hourly' | 'main_daily',
  openAt: Date,
  lockAt: Date,
  resolveAt: Date,
  baseReward: number
) {
  const { data: existing } = await supabase
    .from('rounds')
    .select('id')
    .eq('asset', asset)
    .eq('kind', kind)
    .eq('open_at', openAt.toISOString())
    .maybeSingle()
  if (existing) return

  await supabase.from('rounds').insert({
    season_id: seasonId,
    asset,
    kind,
    state: 'SCHEDULED',
    open_at: openAt.toISOString(),
    lock_at: lockAt.toISOString(),
    resolve_at: resolveAt.toISOString(),
    base_reward: baseReward,
  })
}

/** Creates the next hourly round and the next main-daily round per asset, if missing. */
export async function scheduleUpcomingRounds(now: Date = new Date()): Promise<void> {
  const seasonId = await getActiveSeasonId()

  // Next hourly window
  const nextHour = new Date(now)
  nextHour.setUTCMinutes(0, 0, 0)
  nextHour.setUTCHours(nextHour.getUTCHours() + 1)
  const hourlyLock = new Date(nextHour.getTime() + (60 - PREDICTION_CLOSE_BUFFER_MIN) * 60 * 1000)
  const hourlyResolve = new Date(nextHour.getTime() + 60 * 60 * 1000)

  // Next UTC-midnight main daily round
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const dailyLock = new Date(nextMidnight.getTime() + (24 * 60 - PREDICTION_CLOSE_BUFFER_MIN) * 60 * 1000)
  const dailyResolve = new Date(nextMidnight.getTime() + 24 * 60 * 60 * 1000)

  for (const asset of ASSETS) {
    await ensureRoundExists(seasonId, asset, 'hourly', nextHour, hourlyLock, hourlyResolve, HOURLY_BASE_REWARD)
    await ensureRoundExists(seasonId, asset, 'main_daily', nextMidnight, dailyLock, dailyResolve, MAIN_DAILY_BASE_REWARD)
  }
}

/** SCHEDULED -> OPEN once open_at has passed. */
export async function openDueRounds(now: Date = new Date()): Promise<{ opened: number }> {
  const { data, error } = await supabase
    .from('rounds')
    .update({ state: 'OPEN' as RoundState })
    .eq('state', 'SCHEDULED')
    .lte('open_at', now.toISOString())
    .select('id')
  if (error) throw error
  return { opened: data?.length ?? 0 }
}

/** Refunds any confidence stakes and marks a round VOIDED. Streak is preserved. */
async function voidRound(round: Round, close: number | null = null): Promise<void> {
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('round_id', round.id)
  if (error) throw error

  for (const pred of (predictions ?? []) as Prediction[]) {
    if (pred.confidence > 0) {
      await creditPoints(pred.user_id, pred.confidence, 'refund', { refRound: round.id })
    }
    await supabase.from('predictions').update({ is_correct: null, points_earned: 0 }).eq('id', pred.id)
  }

  await supabase.from('rounds').update({ state: 'VOIDED', close, outcome: 'VOID' }).eq('id', round.id)
}

/** OPEN -> LOCKED, capturing the strike price. Falls back to VOIDED on oracle failure. */
export async function lockDueRounds(now: Date = new Date()): Promise<{ locked: number; voided: number }> {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('state', 'OPEN')
    .lte('lock_at', now.toISOString())
  if (error) throw error

  let locked = 0
  let voided = 0
  for (const round of (rounds ?? []) as Round[]) {
    try {
      const { price } = await getReconciledPrice(round.asset)
      await supabase.from('rounds').update({ state: 'LOCKED', strike: price }).eq('id', round.id)
      locked++
    } catch (e) {
      console.error(`Lock failed for round ${round.id} (${round.asset}):`, e)
      await voidRound(round)
      voided++
    }
  }
  return { locked, voided }
}

/** LOCKED -> SETTLED/VOIDED, running the full settlement algorithm. */
export async function settleDueRounds(now: Date = new Date()): Promise<{ settled: number; voided: number }> {
  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('state', 'LOCKED')
    .lte('resolve_at', now.toISOString())
  if (error) throw error

  let settled = 0
  let voided = 0
  for (const round of (rounds ?? []) as Round[]) {
    await supabase.from('rounds').update({ state: 'SETTLING' }).eq('id', round.id)

    let close: number
    try {
      close = (await getReconciledPrice(round.asset)).price
    } catch (e) {
      console.error(`Settle failed for round ${round.id} (${round.asset}):`, e)
      await voidRound(round)
      voided++
      continue
    }

    if (round.strike == null || close === round.strike) {
      await voidRound(round, close)
      voided++
      continue
    }

    const outcome = close > round.strike ? 'UP' : 'DOWN'

    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('*')
      .eq('round_id', round.id)
    if (predErr) throw predErr

    for (const pred of (predictions ?? []) as Prediction[]) {
      const correct = pred.side === outcome
      let pointsEarned = 0

      if (correct) {
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('streak_count')
          .eq('id', pred.user_id)
          .single()
        if (userErr) throw userErr

        const multiplier = getStreakMultiplier(user.streak_count)
        const reward = Math.round(round.base_reward * multiplier)
        await creditPoints(pred.user_id, reward, 'prediction_win', { refRound: round.id })
        pointsEarned += reward

        if (pred.confidence > 0) {
          const stakeReturn = pred.confidence * 2
          await creditPoints(pred.user_id, stakeReturn, 'stake_return', { refRound: round.id })
          pointsEarned += stakeReturn
        }

        await activateReferralIfPending(pred.user_id)
        await applyDownlineOverride(pred.user_id, pointsEarned)
      }

      await updateStreakAfterSettlement(pred.user_id, correct, now)
      await supabase
        .from('predictions')
        .update({ is_correct: correct, points_earned: pointsEarned })
        .eq('id', pred.id)
    }

    await supabase.from('rounds').update({ state: 'SETTLED', close, outcome }).eq('id', round.id)
    settled++
  }

  return { settled, voided }
}
