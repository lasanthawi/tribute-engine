import { CommunityRewardRow, sb, supabase } from './supabase'
import { getCommunityXp } from './xp'
import type { RewardRuleDto, RewardTriggerType } from './api-client'

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

// Reward rules describe how XP/badges are earned. They are stored in `xp_rules`
// and surfaced to the publisher UI as RewardRuleDto. `triggerType`/`triggerCount`
// drive the automatic evaluator in `lib/reward-rules.ts`; `trigger` stays a
// human-readable label derived from them for display.
const TRIGGER_LABELS: Record<RewardTriggerType, string> = {
  member_joined: 'Member joins the community',
  referral_joined: 'Referred member joins',
  referral_activated: 'Referred member activates',
  purchase_completed: 'Member completes a purchase',
  event_registered: 'Member registers for an event',
  manual: 'Manual unlock',
}

function triggerLabel(triggerType: RewardTriggerType, triggerCount: number): string {
  if (triggerType === 'manual') return TRIGGER_LABELS.manual
  return `${TRIGGER_LABELS[triggerType]} (every ${triggerCount}x)`
}

export interface CreateRewardRuleInput {
  title: string
  triggerType?: RewardTriggerType
  triggerCount?: number
  xpReward?: number
  status?: 'active' | 'draft'
}

export async function listRewardRules(communityId: number): Promise<RewardRuleDto[]> {
  const { data, error } = await sb
    .from('xp_rules')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    trigger: triggerLabel(row.trigger_type, row.trigger_count),
    triggerType: row.trigger_type as RewardTriggerType,
    triggerCount: row.trigger_count,
    reward: `+${row.xp_reward} XP`,
    status: (row.status === 'draft' ? 'draft' : 'active') as RewardRuleDto['status'],
  }))
}

export async function createRewardRule(communityId: number, input: CreateRewardRuleInput): Promise<RewardRuleDto> {
  const triggerType = input.triggerType ?? 'manual'
  const triggerCount = Math.max(1, Math.round(input.triggerCount ?? 1))
  const { data, error } = await sb
    .from('xp_rules')
    .insert({
      community_id: communityId,
      title: input.title,
      trigger: triggerLabel(triggerType, triggerCount),
      trigger_type: triggerType,
      trigger_count: triggerCount,
      xp_reward: Math.max(0, Math.round(input.xpReward ?? 0)),
      status: input.status ?? 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    trigger: triggerLabel(data.trigger_type, data.trigger_count),
    triggerType: data.trigger_type,
    triggerCount: data.trigger_count,
    reward: `+${data.xp_reward} XP`,
    status: data.status === 'draft' ? 'draft' : 'active',
  }
}
