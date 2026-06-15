import { ActivityEventRow, supabase } from './supabase'

export async function getCommunityMetrics(communityId: number) {
  const { count: members } = await supabase
    .from('community_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('community_id', communityId)

  const { count: activeSubscriptions } = await supabase
    .from('member_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'active')

  const { count: referralActivations } = await supabase
    .from('community_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'activated')

  const { data: revenueRows } = await supabase
    .from('community_referrals')
    .select('revenue_cents')
    .eq('community_id', communityId)

  const { data: xpRows } = await supabase.from('community_xp_ledger').select('delta').eq('community_id', communityId)

  const { count: accessIssues } = await supabase
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'failed')

  return {
    members: members ?? 0,
    activeSubscriptions: activeSubscriptions ?? 0,
    referralActivations: referralActivations ?? 0,
    monthlyRevenueCents: (revenueRows ?? []).reduce((sum, row) => sum + row.revenue_cents, 0),
    xpIssued: (xpRows ?? []).reduce((sum, row) => sum + row.delta, 0),
    accessIssues: accessIssues ?? 0,
  }
}

export async function listActivity(communityId: number): Promise<ActivityEventRow[]> {
  const { data, error } = await supabase
    .from('community_activity_events')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as ActivityEventRow[]
}
