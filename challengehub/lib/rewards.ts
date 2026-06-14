import { supabase } from './supabase'
import { creditXp, getUserXp } from './xp'
import { getMembership } from './challenges'

const FINISH_CHALLENGE_XP = 500

export interface RewardCriteria {
  min_xp?: number
  finish_challenge_id?: number
}

/** Lists all rewards (global + tied to a challenge), with the user's claimed status. */
export async function listRewardsForUser(userId: number, challengeId?: number) {
  let query = supabase.from('rewards').select('*').order('id', { ascending: true })
  if (challengeId) {
    query = query.or(`challenge_id.eq.${challengeId},challenge_id.is.null`)
  }
  const { data: rewards, error } = await query
  if (error) throw error

  const { data: claimed, error: claimedErr } = await supabase
    .from('user_rewards')
    .select('reward_id, claimed_at')
    .eq('user_id', userId)
  if (claimedErr) throw claimedErr

  const claimedMap = new Map((claimed ?? []).map((c) => [c.reward_id, c.claimed_at]))

  return (rewards ?? []).map((reward) => ({
    ...reward,
    claimed: claimedMap.has(reward.id),
    claimedAt: claimedMap.get(reward.id) ?? null,
  }))
}

/** Returns true if the user currently meets a reward's claim criteria. */
async function meetsCriteria(userId: number, criteria: RewardCriteria | null): Promise<boolean> {
  if (!criteria) return true

  if (typeof criteria.min_xp === 'number') {
    const { xp } = await getUserXp(userId)
    if (xp < criteria.min_xp) return false
  }

  if (typeof criteria.finish_challenge_id === 'number') {
    const membership = await getMembership(userId, criteria.finish_challenge_id)
    if (!membership || membership.status !== 'completed') return false
  }

  return true
}

export type ClaimResult =
  | { ok: true; alreadyClaimed: false; xpAwarded: number }
  | { ok: true; alreadyClaimed: true; xpAwarded: 0 }
  | { ok: false; reason: string }

/**
 * Claims a reward for the user if criteria are met. If the reward's criteria
 * includes `finish_challenge_id`, also awards the one-time finish-challenge
 * XP bonus (idempotent — only on first claim).
 */
export async function claimReward(userId: number, rewardId: number): Promise<ClaimResult> {
  const { data: reward, error } = await supabase.from('rewards').select('*').eq('id', rewardId).maybeSingle()
  if (error) throw error
  if (!reward) return { ok: false, reason: 'Reward not found' }

  const { data: existing } = await supabase
    .from('user_rewards')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_id', rewardId)
    .maybeSingle()
  if (existing) return { ok: true, alreadyClaimed: true, xpAwarded: 0 }

  const criteria = (reward.criteria ?? null) as RewardCriteria | null
  const eligible = await meetsCriteria(userId, criteria)
  if (!eligible) return { ok: false, reason: 'Criteria not met' }

  const { error: insertErr } = await supabase.from('user_rewards').insert({ user_id: userId, reward_id: rewardId })
  if (insertErr) {
    if (insertErr.code === '23505') return { ok: true, alreadyClaimed: true, xpAwarded: 0 }
    throw insertErr
  }

  let xpAwarded = 0
  if (criteria?.finish_challenge_id) {
    xpAwarded = FINISH_CHALLENGE_XP
    await creditXp(userId, FINISH_CHALLENGE_XP, 'finish_challenge', { refChallenge: criteria.finish_challenge_id })
  }

  return { ok: true, alreadyClaimed: false, xpAwarded }
}

export { FINISH_CHALLENGE_XP }
