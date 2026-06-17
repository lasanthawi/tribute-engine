import { sb, supabase } from './supabase'
import type { SetupStepDto } from './api-client'

// Derives onboarding progress from real community state so the stepper reflects
// what the publisher has actually configured.
export async function computeSetup(communityId: number): Promise<SetupStepDto[]> {
  const [{ data: community }, { count: chatCount }, { count: planCount }, { count: campaignCount }, { count: rewardCount }, { count: accessIssues }] =
    await Promise.all([
      supabase.from('communities').select('telegram_chat_id, name, handle, description').eq('id', communityId).maybeSingle(),
      sb.from('telegram_chats').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      supabase.from('membership_plans').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      sb.from('referral_campaigns').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      supabase.from('community_rewards').select('id', { count: 'exact', head: true }).eq('community_id', communityId),
      supabase.from('telegram_access_logs').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'failed'),
    ])

  const hasProfile = !!community?.name
  const hasTelegram = !!community?.telegram_chat_id || (chatCount ?? 0) > 0
  const hasPlan = (planCount ?? 0) > 0
  const hasCampaign = (campaignCount ?? 0) > 0
  const hasReward = (rewardCount ?? 0) > 0
  const cleanAccess = (accessIssues ?? 0) === 0

  const step = (done: boolean, active: boolean): SetupStepDto['status'] => (done ? 'done' : active ? 'active' : 'locked')

  return [
    { id: 'profile', title: 'Create community profile', detail: 'Name, handle, and description.', status: step(hasProfile, true) },
    { id: 'telegram', title: 'Connect Telegram group', detail: 'Add the bot as admin so it can manage access.', status: step(hasTelegram, hasProfile) },
    { id: 'plan', title: 'Create paid plan', detail: 'Launch a Stars membership.', status: step(hasPlan, hasTelegram) },
    { id: 'referral', title: 'Launch referral loop', detail: 'Reward members for inviting others.', status: step(hasCampaign, hasPlan) },
    { id: 'reward', title: 'Create first reward', detail: 'Set up badges or XP unlocks.', status: step(hasReward, hasPlan) },
    {
      id: 'launch',
      title: 'Launch community',
      detail: 'Resolve access issues before opening the next cohort.',
      status: hasProfile && hasTelegram && hasPlan && cleanAccess ? 'done' : hasPlan ? 'active' : 'locked',
    },
  ]
}
