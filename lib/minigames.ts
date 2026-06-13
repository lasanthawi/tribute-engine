import { supabase, MinigameType } from './supabase'
import { creditPoints, adjustTickets, creditCoins } from './ledger'

export const TAP_GAME_MAX_PLAYS_PER_DAY = 3
export const SPIN_WHEEL_MAX_PLAYS_PER_DAY = 1
export const TAP_GAME_DURATION_SEC = 30
export const TAP_GAME_MAX_SCORE = 60 // hard server cap: ~2 taps/sec sustained for 30s is already generous

export const SPIN_SEGMENTS = [
  { label: '10 pts', weight: 30, rewardPoints: 10, rewardTickets: 0, rewardCoins: 0 },
  { label: '20 pts', weight: 25, rewardPoints: 20, rewardTickets: 0, rewardCoins: 0 },
  { label: '50 pts', weight: 18, rewardPoints: 50, rewardTickets: 0, rewardCoins: 0 },
  { label: '5 coins', weight: 12, rewardPoints: 0, rewardTickets: 0, rewardCoins: 5 },
  { label: '100 pts', weight: 10, rewardPoints: 100, rewardTickets: 0, rewardCoins: 0 },
  { label: '1 ticket', weight: 4, rewardPoints: 0, rewardTickets: 1, rewardCoins: 0 },
  { label: 'Jackpot 250', weight: 1, rewardPoints: 250, rewardTickets: 0, rewardCoins: 0 },
] as const

const PLAY_LIMITS: Record<MinigameType, number> = {
  tap: TAP_GAME_MAX_PLAYS_PER_DAY,
  spin: SPIN_WHEEL_MAX_PLAYS_PER_DAY,
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Tiered points reward for the tap game based on a server-validated score. */
export function computeTapReward(score: number): number {
  const clamped = Math.max(0, Math.min(TAP_GAME_MAX_SCORE, score))
  if (clamped === 0) return 0
  if (clamped < 5) return 5
  if (clamped < 10) return 10
  if (clamped < 15) return 15
  if (clamped < 20) return 20
  if (clamped < 30) return 30
  return 40
}

export async function getPlaysToday(userId: number, gameType: MinigameType, now: Date = new Date()): Promise<number> {
  const { count, error } = await supabase
    .from('minigame_plays')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game_type', gameType)
    .eq('played_date', toUtcDateString(now))
  if (error) throw error
  return count ?? 0
}

export async function getRemainingPlays(userId: number, gameType: MinigameType, now: Date = new Date()): Promise<number> {
  const playsToday = await getPlaysToday(userId, gameType, now)
  return Math.max(0, PLAY_LIMITS[gameType] - playsToday)
}

export async function playTapGame(
  userId: number,
  score: number,
  now: Date = new Date()
): Promise<{ rewardPoints: number; remainingPlays: number }> {
  const playsToday = await getPlaysToday(userId, 'tap', now)
  if (playsToday >= TAP_GAME_MAX_PLAYS_PER_DAY) throw new Error('No plays remaining')

  const clampedScore = Math.max(0, Math.min(TAP_GAME_MAX_SCORE, Math.trunc(score)))
  const rewardPoints = computeTapReward(clampedScore)

  const { error } = await supabase.from('minigame_plays').insert({
    user_id: userId,
    game_type: 'tap',
    played_date: toUtcDateString(now),
    score: clampedScore,
    reward_points: rewardPoints,
  })
  if (error) throw error

  if (rewardPoints > 0) await creditPoints(userId, rewardPoints, 'minigame_reward')

  return { rewardPoints, remainingPlays: TAP_GAME_MAX_PLAYS_PER_DAY - (playsToday + 1) }
}

export async function spinWheel(
  userId: number,
  now: Date = new Date()
): Promise<{ segmentIndex: number; rewardPoints: number; rewardTickets: number; rewardCoins: number; remainingPlays: number }> {
  const playsToday = await getPlaysToday(userId, 'spin', now)
  if (playsToday >= SPIN_WHEEL_MAX_PLAYS_PER_DAY) throw new Error('No plays remaining')

  const totalWeight = SPIN_SEGMENTS.reduce((sum, s) => sum + s.weight, 0)
  let roll = Math.random() * totalWeight
  let segmentIndex = SPIN_SEGMENTS.length - 1
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    roll -= SPIN_SEGMENTS[i].weight
    if (roll <= 0) {
      segmentIndex = i
      break
    }
  }
  const segment = SPIN_SEGMENTS[segmentIndex]

  const { error } = await supabase.from('minigame_plays').insert({
    user_id: userId,
    game_type: 'spin',
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
    remainingPlays: 0,
  }
}
