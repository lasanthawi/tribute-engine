import { supabase } from './supabase'
import { creditPoints, adjustTickets, creditCoins } from './ledger'
import { getGameBySlug } from './games-catalog'
import { computeTapRewardFromCurve, pickSpinSegment, TapCatchConfig, SpinWheelConfig } from './game-templates'

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getPlaysToday(userId: number, slug: string, now: Date = new Date()): Promise<number> {
  const { count, error } = await supabase
    .from('minigame_plays')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game_slug', slug)
    .eq('played_date', toUtcDateString(now))
  if (error) throw error
  return count ?? 0
}

export async function getRemainingPlays(userId: number, slug: string, maxPlaysPerDay: number, now: Date = new Date()): Promise<number> {
  const playsToday = await getPlaysToday(userId, slug, now)
  return Math.max(0, maxPlaysPerDay - playsToday)
}

export async function playTapGame(
  userId: number,
  slug: string,
  score: number,
  now: Date = new Date()
): Promise<{ rewardPoints: number; remainingPlays: number }> {
  const game = await getGameBySlug(slug)
  if (!game || game.template !== 'tap_catch') throw new Error('Game not found')

  const playsToday = await getPlaysToday(userId, slug, now)
  if (playsToday >= game.maxPlaysPerDay) throw new Error('No plays remaining')

  const config = game.config as TapCatchConfig
  const clampedScore = Math.max(0, Math.min(config.maxScore, Math.trunc(score)))
  const rewardPoints = computeTapRewardFromCurve(clampedScore, config)

  const { error } = await supabase.from('minigame_plays').insert({
    user_id: userId,
    game_slug: slug,
    played_date: toUtcDateString(now),
    score: clampedScore,
    reward_points: rewardPoints,
  })
  if (error) throw error

  if (rewardPoints > 0) await creditPoints(userId, rewardPoints, 'minigame_reward')

  return { rewardPoints, remainingPlays: game.maxPlaysPerDay - (playsToday + 1) }
}

export async function spinWheel(
  userId: number,
  slug: string,
  now: Date = new Date()
): Promise<{ segmentIndex: number; rewardPoints: number; rewardTickets: number; rewardCoins: number; remainingPlays: number }> {
  const game = await getGameBySlug(slug)
  if (!game || game.template !== 'spin_wheel') throw new Error('Game not found')

  const playsToday = await getPlaysToday(userId, slug, now)
  if (playsToday >= game.maxPlaysPerDay) throw new Error('No plays remaining')

  const config = game.config as SpinWheelConfig
  const { segmentIndex, segment } = pickSpinSegment(config)

  const { error } = await supabase.from('minigame_plays').insert({
    user_id: userId,
    game_slug: slug,
    played_date: toUtcDateString(now),
    score: null,
    reward_points: segment.rewardPoints,
    reward_tickets: segment.rewardTickets,
    reward_coins: segment.rewardCoins,
    reward_label: `spin_segment_${segmentIndex}`,
  })
  if (error) throw error

  if (segment.rewardPoints > 0) await creditPoints(userId, segment.rewardPoints, 'minigame_reward')
  if (segment.rewardTickets > 0) await adjustTickets(userId, segment.rewardTickets, 'minigame_reward')
  if (segment.rewardCoins > 0) await creditCoins(userId, segment.rewardCoins, 'minigame_reward')

  return {
    segmentIndex,
    rewardPoints: segment.rewardPoints,
    rewardTickets: segment.rewardTickets,
    rewardCoins: segment.rewardCoins,
    remainingPlays: game.maxPlaysPerDay - (playsToday + 1),
  }
}
