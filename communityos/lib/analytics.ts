import { ActivityEventRow, sb, supabase } from './supabase'

export interface CommunityMetrics {
  healthScore: number
  members: number
  activeSubscriptions: number
  pendingRenewals: number
  referralActivations: number
  monthlyRevenueCents: number
  monthlyStars: number
  xpIssued: number
  accessIssues: number
  productsSold: number
}

export async function getCommunityMetrics(communityId: number): Promise<CommunityMetrics> {
  const { count: members } = await supabase
    .from('community_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('community_id', communityId)

  const { count: activeSubscriptions } = await supabase
    .from('member_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'active')

  const { count: pendingRenewals } = await supabase
    .from('member_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'past_due')

  const { count: referralActivations } = await supabase
    .from('community_referrals')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'activated')

  const { data: xpRows } = await supabase.from('community_xp_ledger').select('delta').eq('community_id', communityId)

  const { count: accessIssues } = await supabase
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('status', 'failed')

  // Revenue: paid Stars purchases + active subscription plan prices.
  const { data: purchases } = await sb
    .from('purchases')
    .select('amount_cents, amount_stars, product_id, status')
    .eq('community_id', communityId)
    .eq('status', 'paid')

  const purchaseCents = (purchases ?? []).reduce((sum: number, row: any) => sum + (row.amount_cents ?? 0), 0)
  const monthlyStars = (purchases ?? []).reduce((sum: number, row: any) => sum + (row.amount_stars ?? 0), 0)
  const productsSold = (purchases ?? []).filter((row: any) => row.product_id).length

  const { data: activeSubs } = await supabase
    .from('member_subscriptions')
    .select('plan_id')
    .eq('community_id', communityId)
    .eq('status', 'active')

  const planIds = Array.from(
    new Set((activeSubs ?? []).map((s) => s.plan_id).filter((id): id is number => typeof id === 'number'))
  )
  const { data: plans } = planIds.length
    ? await supabase.from('membership_plans').select('id, price_cents').in('id', planIds)
    : { data: [] as { id: number; price_cents: number }[] }
  const planPrice = new Map((plans ?? []).map((p) => [p.id, p.price_cents]))
  const subsCents = (activeSubs ?? []).reduce((sum, s) => sum + (s.plan_id ? planPrice.get(s.plan_id) ?? 0 : 0), 0)

  const accessIssueCount = accessIssues ?? 0
  const renewalCount = pendingRenewals ?? 0
  const healthScore = Math.max(0, Math.min(100, 100 - accessIssueCount * 5 - renewalCount * 6))

  return {
    healthScore,
    members: members ?? 0,
    activeSubscriptions: activeSubscriptions ?? 0,
    pendingRenewals: renewalCount,
    referralActivations: referralActivations ?? 0,
    monthlyRevenueCents: purchaseCents + subsCents,
    monthlyStars,
    xpIssued: (xpRows ?? []).reduce((sum, row) => sum + row.delta, 0),
    accessIssues: accessIssueCount,
    productsSold,
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
