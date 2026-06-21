import { getCommunityMetrics } from './analytics'
import { sb, supabase } from './supabase'
import type { AdminDashboardDto } from './api-client'

export async function isPlatformAdmin(userId: number): Promise<boolean> {
  const { data, error } = await sb.from('platform_admins').select('id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return !!data
}

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  const { data: communities } = await supabase
    .from('communities')
    .select('id, name, handle, description, status, owner_id')
    .order('created_at', { ascending: false })
    .limit(50)

  const communityRows = communities ?? []
  const ownerIds = Array.from(new Set(communityRows.map((c) => c.owner_id)))
  const { data: owners } = ownerIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', ownerIds)
    : { data: [] as { id: number; username: string | null; telegram_id: number }[] }
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.username ?? `user_${o.telegram_id}`]))

  const perCommunity = await Promise.all(
    communityRows.map(async (c) => {
      const metrics = await getCommunityMetrics(c.id)
      return {
        id: c.id,
        name: c.name,
        handle: c.handle,
        description: c.description,
        status: c.status,
        owner: `@${ownerMap.get(c.owner_id) ?? 'owner'}`,
        members: metrics.members,
        revenueCents: metrics.monthlyRevenueCents,
        healthScore: metrics.healthScore,
      }
    })
  )

  const { data: paidPurchases } = await sb.from('purchases').select('amount_stars, amount_cents').eq('status', 'paid')
  const monthlyStars = (paidPurchases ?? []).reduce((sum: number, r: any) => sum + (r.amount_stars ?? 0), 0)
  const paymentsCents = (paidPurchases ?? []).reduce((sum: number, r: any) => sum + (r.amount_cents ?? 0), 0)

  const { count: accessFailures } = await supabase
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
  const { count: aiRequests } = await sb.from('ai_request_logs').select('id', { count: 'exact', head: true })

  const { data: recentPurchases } = await sb
    .from('purchases')
    .select('id, community_id, buyer_user_id, amount_stars, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  const communityNameMap = new Map(communityRows.map((c) => [c.id, c.name]))
  const buyerIds: number[] = Array.from(
    new Set((recentPurchases ?? []).map((p: any) => p.buyer_user_id).filter((id: unknown): id is number => typeof id === 'number'))
  )
  const { data: buyers } = buyerIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', buyerIds)
    : { data: [] as { id: number; username: string | null; telegram_id: number }[] }
  const buyerMap = new Map((buyers ?? []).map((b) => [b.id, b.username ?? `user_${b.telegram_id}`]))

  const payments = (recentPurchases ?? []).map((p: any) => ({
    id: p.id,
    community: communityNameMap.get(p.community_id) ?? `#${p.community_id}`,
    buyer: `@${buyerMap.get(p.buyer_user_id) ?? 'member'}`,
    stars: p.amount_stars,
    status: p.status,
    createdAt: p.created_at,
  }))

  const { data: failedLogs } = await supabase
    .from('telegram_access_logs')
    .select('id, community_id, message')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10)

  const issues = (failedLogs ?? []).map((log) => ({
    id: log.id,
    title: log.message ?? 'Access sync failure',
    community: communityNameMap.get(log.community_id) ?? `#${log.community_id}`,
    severity: 'high' as const,
    status: 'open',
  }))

  return {
    metrics: {
      communities: communityRows.length,
      publishers: ownerIds.length,
      monthlyStars,
      paymentsCents,
      accessFailures: accessFailures ?? 0,
      aiRequests: aiRequests ?? 0,
    },
    communities: perCommunity,
    payments,
    issues,
  }
}
