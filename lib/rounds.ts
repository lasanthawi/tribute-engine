import { supabase, Asset, RoundState, Database } from './supabase'
import { getReconciledPrice } from './oracle'
import { creditPoints, adjustTickets, getUserBalance } from './ledger'
import { getStreakMultiplier, updateStreakAfterSettlement } from './streak'
import { activateReferralIfPending, applyDownlineOverride } from './referral'
import { sendTelegramMessage } from './telegram'
import { recordQuestProgress, QuestDefinition } from './quests'
import { checkAndUnlockAchievements } from './achievements'
import { sendMilestoneCelebration, sendQuestCompletedCelebration, postBigWinAnnouncement } from './marketing'

type Round = Database['public']['Tables']['rounds']['Row']
type Prediction = Database['public']['Tables']['predictions']['Row']

const ASSETS: Asset[] = ['BTC', 'ETH', 'TON']
const ASSET_EMOJI: Record<Asset, string> = { BTC: '₿', ETH: 'Ξ', TON: '◆' }
const HOURLY_BASE_REWARD = 100
const MAIN_DAILY_BASE_REWARD = 500
const PREDICTION_CLOSE_BUFFER_MIN = 5
const BIG_WIN_THRESHOLD = 500

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function roundLabel(round: Round): string {
  return round.kind === 'main_daily' ? 'Main Vote' : 'Hourly Vote'
}

async function getTelegramIds(userIds: number[]): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase.from('users').select('id, telegram_id').in('id', userIds)
  if (error) throw error
  return new Map((data ?? []).map((u) => [u.id, u.telegram_id]))
}

/** Best-effort settlement DM — never throws (a Telegram outage shouldn't block settlement). */
async function notifyUser(telegramId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      text,
      'Markdown',
      MINI_APP_URL ? { inline_keyboard: [[{ text: '▶ Open VOTE LEAGUE', web_app: { url: MINI_APP_URL } }]] } : undefined
    )
  } catch (e) {
    console.error(`Settlement notification failed for telegram user ${telegramId}:`, e)
  }
}

function settlementMessage(round: Round, pred: Prediction, correct: boolean, outcome: string, pointsEarned: number): string {
  const emoji = ASSET_EMOJI[round.asset]
  const label = roundLabel(round)
  if (correct) {
    return `✅ *${emoji} ${round.asset}* ${label} settled *${outcome}* — you called it right!\n+${pointsEarned} pts`
  }
  const stakeNote = pred.confidence > 0 ? ` (−${pred.confidence} pts staked)` : ''
  return `❌ *${emoji} ${round.asset}* ${label} settled *${outcome}* — you called ${pred.side}.${stakeNote}\nNew votes are open — call it 🗳️`
}

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
export async function openDueRounds(now: Date = new Date()): Promise<{ opened: number; openedMainDaily: Round[] }> {
  const { data, error } = await supabase
    .from('rounds')
    .update({ state: 'OPEN' as RoundState })
    .eq('state', 'SCHEDULED')
    .lte('open_at', now.toISOString())
    .select('*')
  if (error) throw error
  const rounds = (data ?? []) as Round[]
  return { opened: rounds.length, openedMainDaily: rounds.filter((r) => r.kind === 'main_daily') }
}

/** Refunds confidence stakes + tickets and marks a round VOIDED. Streak is preserved. */
async function voidRound(round: Round, close: number | null = null): Promise<void> {
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('round_id', round.id)
  if (error) throw error

  const preds = (predictions ?? []) as Prediction[]
  const telegramIds = await getTelegramIds(preds.map((p) => p.user_id))

  for (const pred of preds) {
    if (pred.confidence > 0) {
      await creditPoints(pred.user_id, pred.confidence, 'refund', { refRound: round.id })
    }
    await adjustTickets(pred.user_id, 1, 'refund')
    await supabase.from('predictions').update({ is_correct: null, points_earned: 0 }).eq('id', pred.id)

    const telegramId = telegramIds.get(pred.user_id)
    if (telegramId) {
      await notifyUser(
        telegramId,
        `⟳ *${ASSET_EMOJI[round.asset]} ${round.asset}* ${roundLabel(round)} was voided (no clean price move) — your ticket and stake have been refunded.`
      )
    }
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

    const preds = (predictions ?? []) as Prediction[]
    let userMap = new Map<number, { id: number; telegram_id: number; streak_count: number; username: string | null }>()
    if (preds.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, telegram_id, streak_count, username')
        .in('id', preds.map((p) => p.user_id))
      if (usersErr) throw usersErr
      userMap = new Map((users ?? []).map((u) => [u.id, u]))
    }

    for (const pred of preds) {
      const correct = pred.side === outcome
      const user = userMap.get(pred.user_id)
      let pointsEarned = 0

      if (correct) {
        const multiplier = getStreakMultiplier(user?.streak_count ?? 0)
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

      let completedQuests: QuestDefinition[] = []
      if (correct) {
        completedQuests = [
          ...(await recordQuestProgress(pred.user_id, 'correct_count', 1)),
          ...(await recordQuestProgress(pred.user_id, 'streak_maintain', 1)),
        ]
      } else {
        await recordQuestProgress(pred.user_id, 'streak_maintain', 0, { reset: true })
      }

      const { data: updatedUser } = await supabase
        .from('users')
        .select('streak_count')
        .eq('id', pred.user_id)
        .single()
      const { points } = await getUserBalance(pred.user_id)
      const newlyUnlocked = await checkAndUnlockAchievements(pred.user_id, {
        event: 'settlement',
        correct,
        streakCount: updatedUser?.streak_count ?? 0,
        points,
      })

      if (user?.telegram_id) {
        await notifyUser(user.telegram_id, settlementMessage(round, pred, correct, outcome, pointsEarned))
        for (const achievement of newlyUnlocked) {
          await sendMilestoneCelebration(user.telegram_id, achievement)
        }
        for (const quest of completedQuests) {
          await sendQuestCompletedCelebration(user.telegram_id, quest.title)
        }
      }

      if (correct && pointsEarned >= BIG_WIN_THRESHOLD) {
        await postBigWinAnnouncement(user?.username ?? null, round.asset, pointsEarned)
      }
    }

    await supabase.from('rounds').update({ state: 'SETTLED', close, outcome }).eq('id', round.id)
    settled++
  }

  return { settled, voided }
}
