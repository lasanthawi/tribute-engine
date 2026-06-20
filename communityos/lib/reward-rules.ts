import { sb, supabase } from './supabase'
import { creditCommunityXp } from './xp'

export type RewardTriggerType =
  | 'member_joined'
  | 'referral_joined'
  | 'referral_activated'
  | 'purchase_completed'
  | 'event_registered'
  | 'manual'

interface XpRuleRow {
  id: number
  xp_reward: number
  trigger_count: number
}

async function countOccurrences(communityId: number, userId: number, triggerType: RewardTriggerType): Promise<number> {
  switch (triggerType) {
    case 'member_joined':
      // Only called from the member's genuine first access grant, so this
      // trigger's occurrence count is always exactly one.
      return 1
    case 'referral_joined':
    case 'referral_activated': {
      const { data: referral } = await supabase
        .from('community_referrals')
        .select('id')
        .eq('community_id', communityId)
        .eq('referrer_id', userId)
        .maybeSingle()
      if (!referral) return 0
      const attributionType = triggerType === 'referral_joined' ? 'join' : 'activated'
      const { count } = await sb
        .from('referral_attributions')
        .select('id', { count: 'exact', head: true })
        .eq('referral_id', referral.id)
        .eq('attribution_type', attributionType)
      return count ?? 0
    }
    case 'purchase_completed': {
      const { count } = await sb
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', communityId)
        .eq('buyer_user_id', userId)
        .eq('status', 'paid')
      return count ?? 0
    }
    case 'event_registered': {
      const { count } = await sb
        .from('community_activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .eq('event_type', 'event_registered')
      return count ?? 0
    }
    default:
      return 0
  }
}

// Evaluates every active rule configured for `triggerType` and grants XP for
// any newly-reached occurrence milestone (count, 2x count, 3x count, ...).
// Safe to call repeatedly/concurrently: the xp_rule_grants unique constraint
// on (rule_id, user_id, occurrence_count) makes each milestone grant exactly
// once no matter how many times the same underlying event re-evaluates it.
export async function evaluateRewardRules(communityId: number, userId: number, triggerType: RewardTriggerType) {
  if (triggerType === 'manual') return

  const { data: rules, error } = await sb
    .from('xp_rules')
    .select('id, xp_reward, trigger_count')
    .eq('community_id', communityId)
    .eq('trigger_type', triggerType)
    .eq('status', 'active')
  if (error) throw error
  if (!rules?.length) return

  const count = await countOccurrences(communityId, userId, triggerType)
  if (count <= 0) return

  for (const rule of rules as XpRuleRow[]) {
    const threshold = Math.max(1, rule.trigger_count)
    if (count < threshold) continue
    const milestone = Math.floor(count / threshold) * threshold

    const { error: grantError } = await sb
      .from('xp_rule_grants')
      .insert({ community_id: communityId, rule_id: rule.id, user_id: userId, occurrence_count: milestone })
    if (grantError) {
      if (grantError.code === '23505') continue
      throw grantError
    }

    await creditCommunityXp(communityId, userId, rule.xp_reward, 'reward_rule', {
      metadata: { ruleId: rule.id, triggerType, occurrenceCount: milestone },
    })
  }
}
