import { CommunityRewardRow, supabase } from './supabase'
import { getCommunityXp } from './xp'

export interface CreateRewardInput {
  type?: 'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'sponsor' | 'manual'
  title: string
  description?: string | null
  criteria?: Record<string, unknown>
}

export async function listRewards(communityId: number, userId?: number): Promise<(CommunityRewardRow & { claimed: boolean })[]> {
  const { data: rewards, error } = await supabase
    .from('community_rewards')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .order('id', { ascending: true })
  if (error) throw error

  if (!userId) return ((rewards ?? []) as CommunityRewardRow[]).map((reward) => ({ ...reward, claimed: false }))

  const { data: claimed, error: claimedErr } = await supabase
    .from('community_user_rewards')
    .select('reward_id')
    .eq('community_id', communityId)
    .eq('user_id', userId)
  if (claimedErr) throw claimedErr

  const claimedIds = new Set(((claimed ?? []) as { reward_id: number }[]).map((row) => row.reward_id))
  return ((rewards ?? []) as CommunityRewardRow[]).map((reward) => ({ ...reward, claimed: claimedIds.has(reward.id) }))
}

export async function createReward(communityId: number, input: CreateRewardInput) {
  const { data, error } = await supabase
    .from('community_rewards')
    .insert({
      community_id: communityId,
      type: input.type ?? 'badge',
      title: input.title,
      description: input.description ?? null,
      criteria: input.criteria ?? {},
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CommunityRewardRow
}

async function meetsCriteria(communityId: number, userId: number, criteria: Record<string, unknown>) {
  const minXp = typeof criteria.min_xp === 'number' ? criteria.min_xp : 0
  if (!minXp) return true
  const { xp } = await getCommunityXp(communityId, userId)
  return xp >= minXp
}

export async function claimReward(communityId: number, userId: number, rewardId: number) {
  const { data: reward, error } = await supabase
    .from('community_rewards')
    .select('*')
    .eq('community_id', communityId)
    .eq('id', rewardId)
    .maybeSingle()
  if (error) throw error
  if (!reward) return { ok: false, reason: 'Reward not found' }

  const rewardRow = reward as CommunityRewardRow
  const eligible = await meetsCriteria(communityId, userId, rewardRow.criteria)
  if (!eligible) return { ok: false, reason: 'Criteria not met' }

  const { error: insertErr } = await supabase
    .from('community_user_rewards')
    .insert({ community_id: communityId, user_id: userId, reward_id: rewardId })
  if (insertErr) {
    if (insertErr.code === '23505') return { ok: true, alreadyClaimed: true }
    throw insertErr
  }

  return { ok: true, alreadyClaimed: false }
}
