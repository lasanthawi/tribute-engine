import { getCommunityMetrics } from './analytics'
import { listMembers, getCommunity } from './communities'
import { listAccessLogs } from './access-control'
import { sb, supabase, CommunityStatus } from './supabase'
import type { AdminDashboardDto } from './api-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86400000).toISOString()
}

function adminTelegramIds(): number[] {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
}

// Records an admin mutation to audit_events. Best-effort: never throws so the
// primary action is not blocked by an audit write failure.
export async function recordAuditEvent(opts: {
  actorUserId: number
  communityId?: number | null
  eventType: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    await sb.from('audit_events').insert({
      actor_user_id: opts.actorUserId,
      community_id: opts.communityId ?? null,
      event_type: opts.eventType,
      payload: opts.payload ?? {},
    })
  } catch (error) {
    console.error('recordAuditEvent failed:', error)
  }
}

// ---------------------------------------------------------------------------
// Admin identity
// ---------------------------------------------------------------------------

// True when the user has a platform_admins row, OR their Telegram id is listed in
// ADMIN_TELEGRAM_IDS (first-admin bootstrap). Bootstrapped admins are auto-seeded
// into platform_admins so the env var is only needed for the very first login.
export async function isPlatformAdmin(userId: number): Promise<boolean> {
  const { data, error } = await sb.from('platform_admins').select('id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return true

  const bootstrapIds = adminTelegramIds()
  if (bootstrapIds.length === 0) return false

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle()
  if (!user || !bootstrapIds.includes(Number(user.telegram_id))) return false

  // Auto-seed so the admin persists without the env var. Best-effort.
  try {
    await sb.from('platform_admins').upsert({ user_id: userId, role: 'owner' }, { onConflict: 'user_id' })
  } catch (error) {
    console.error('platform admin auto-seed failed:', error)
  }
  return true
}

// ---------------------------------------------------------------------------
// Platform-wide overview (computed on-the-fly with 30-day windows)
// ---------------------------------------------------------------------------

export interface PlatformOverview {
  communities: number
  activeCommunities: number
  newCommunities30d: number
  publishers: number
  stars30d: number
  revenueCents30d: number
  revenueCentsAllTime: number
  mrrCents: number
  expiredSubs30d: number
  accessSuccessRate: number
  pendingJoinRequests: number
  accessFailures: number
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const since = thirtyDaysAgo()

  const { count: communities } = await sb.from('communities').select('id', { count: 'exact', head: true })
  const { count: activeCommunities } = await sb
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  const { count: newCommunities30d } = await sb
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  const { data: owners } = await sb.from('communities').select('owner_id')
  const publishers = new Set((owners ?? []).map((row: any) => row.owner_id)).size

  // Revenue (paid purchases) — all-time and 30-day windows.
  const { data: allPaid } = await sb.from('purchases').select('amount_cents').eq('status', 'paid')
  const revenueCentsAllTime = (allPaid ?? []).reduce((sum: number, r: any) => sum + (r.amount_cents ?? 0), 0)

  const { data: paid30d } = await sb
    .from('purchases')
    .select('amount_stars, amount_cents')
    .eq('status', 'paid')
    .gte('created_at', since)
  const stars30d = (paid30d ?? []).reduce((sum: number, r: any) => sum + (r.amount_stars ?? 0), 0)
  const revenueCents30d = (paid30d ?? []).reduce((sum: number, r: any) => sum + (r.amount_cents ?? 0), 0)

  // MRR proxy: sum of active subscription plan prices.
  const { data: activeSubs } = await sb.from('member_subscriptions').select('plan_id').eq('status', 'active')
  const planIds = Array.from(
    new Set((activeSubs ?? []).map((s: any) => s.plan_id).filter((id: unknown): id is number => typeof id === 'number'))
  )
  const { data: plans } = planIds.length
    ? await sb.from('membership_plans').select('id, price_cents').in('id', planIds)
    : { data: [] as { id: number; price_cents: number }[] }
  const planPrice = new Map((plans ?? []).map((p: any) => [p.id, p.price_cents]))
  const mrrCents = (activeSubs ?? []).reduce((sum: number, s: any) => sum + (s.plan_id ? Number(planPrice.get(s.plan_id) ?? 0) : 0), 0)

  const { count: expiredSubs30d } = await sb
    .from('member_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'expired')
    .gte('updated_at', since)

  const { count: accessSuccess } = await sb
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'success')
    .gte('created_at', since)
  const { count: accessFailed } = await sb
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', since)
  const successTotal = (accessSuccess ?? 0) + (accessFailed ?? 0)
  const accessSuccessRate = successTotal > 0 ? Math.round(((accessSuccess ?? 0) / successTotal) * 100) : 100

  const { count: accessFailures } = await sb
    .from('telegram_access_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')

  const { count: pendingJoinRequests } = await sb
    .from('telegram_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  return {
    communities: communities ?? 0,
    activeCommunities: activeCommunities ?? 0,
    newCommunities30d: newCommunities30d ?? 0,
    publishers,
    stars30d,
    revenueCents30d,
    revenueCentsAllTime,
    mrrCents,
    expiredSubs30d: expiredSubs30d ?? 0,
    accessSuccessRate,
    pendingJoinRequests: pendingJoinRequests ?? 0,
    accessFailures: accessFailures ?? 0,
  }
}

// IDs of access-log issues that have been resolved (recorded as audit events).
async function resolvedIssueIds(): Promise<Set<number>> {
  const { data } = await sb
    .from('audit_events')
    .select('payload')
    .eq('event_type', 'access_issue_resolved')
    .order('created_at', { ascending: false })
    .limit(500)
  const ids = new Set<number>()
  for (const row of data ?? []) {
    const logId = Number((row as any).payload?.logId)
    if (Number.isFinite(logId)) ids.add(logId)
  }
  return ids
}

function severityForLog(log: { action?: string | null; message?: string | null }): 'high' | 'medium' | 'low' {
  if (log.action === 'sync') return 'high'
  if (log.action === 'grant' || log.action === 'invite_link') return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// Dashboard (overview metrics + recent tables)
// ---------------------------------------------------------------------------

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  const overview = await getPlatformOverview()

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

  const communityNameMap = new Map(communityRows.map((c) => [c.id, c.name]))

  const { data: recentPurchases } = await sb
    .from('purchases')
    .select('id, community_id, buyer_user_id, amount_stars, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

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

  const resolved = await resolvedIssueIds()
  const { data: failedLogs } = await supabase
    .from('telegram_access_logs')
    .select('id, community_id, action, message')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(30)

  const issues = (failedLogs ?? [])
    .filter((log: any) => !resolved.has(log.id))
    .slice(0, 10)
    .map((log: any) => ({
      id: log.id,
      title: log.message ?? 'Access sync failure',
      community: communityNameMap.get(log.community_id) ?? `#${log.community_id}`,
      severity: severityForLog(log),
      status: 'open',
    }))

  return {
    metrics: {
      communities: overview.communities,
      publishers: overview.publishers,
      monthlyStars: overview.stars30d,
      paymentsCents: overview.revenueCents30d,
      accessFailures: overview.accessFailures,
      aiRequests: overview.pendingJoinRequests,
    },
    overview,
    communities: perCommunity,
    payments,
    issues,
  }
}

// ---------------------------------------------------------------------------
// Community lifecycle + detail
// ---------------------------------------------------------------------------

export async function getAdminCommunityDetail(communityId: number) {
  const community = await getCommunity(communityId)
  if (!community) return null

  const [metrics, members, logs] = await Promise.all([
    getCommunityMetrics(communityId),
    listMembers(communityId),
    listAccessLogs(communityId),
  ])

  const { data: ownerRow } = await supabase
    .from('users')
    .select('id, username, telegram_id')
    .eq('id', community.owner_id)
    .maybeSingle()

  const { data: recentPurchases } = await sb
    .from('purchases')
    .select('id, buyer_user_id, amount_stars, status, created_at')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(20)

  return {
    community: {
      id: community.id,
      name: community.name,
      handle: community.handle,
      description: community.description,
      status: community.status,
      telegramChatId: community.telegram_chat_id,
      owner: ownerRow?.username ?? (ownerRow ? `user_${ownerRow.telegram_id}` : 'owner'),
    },
    metrics,
    members,
    logs,
    payments: recentPurchases ?? [],
  }
}

export async function setCommunityStatus(communityId: number, status: CommunityStatus, adminId: number) {
  const { data, error } = await supabase
    .from('communities')
    .update({ status })
    .eq('id', communityId)
    .select('id, status')
    .single()
  if (error) throw error
  await recordAuditEvent({
    actorUserId: adminId,
    communityId,
    eventType: status === 'paused' ? 'community_paused' : status === 'archived' ? 'community_archived' : 'community_activated',
    payload: { status },
  })
  return data
}

// ---------------------------------------------------------------------------
// Access issue resolution
// ---------------------------------------------------------------------------

export async function resolveAccessIssue(logId: number, adminId: number) {
  const { data: log } = await sb.from('telegram_access_logs').select('community_id').eq('id', logId).maybeSingle()
  await recordAuditEvent({
    actorUserId: adminId,
    communityId: log?.community_id ?? null,
    eventType: 'access_issue_resolved',
    payload: { logId },
  })
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Platform admin management
// ---------------------------------------------------------------------------

export async function listPlatformAdmins() {
  const { data: admins } = await sb
    .from('platform_admins')
    .select('id, user_id, role, created_at')
    .order('created_at', { ascending: true })
  const rows = admins ?? []
  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id))) as number[]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', userIds)
    : { data: [] as { id: number; username: string | null; telegram_id: number }[] }
  const userMap = new Map((users ?? []).map((u) => [u.id, u]))
  return rows.map((r: any) => {
    const user = userMap.get(r.user_id)
    return {
      id: r.id,
      userId: r.user_id,
      role: r.role,
      username: user?.username ?? null,
      telegramId: user?.telegram_id ?? null,
      createdAt: r.created_at,
    }
  })
}

export async function addPlatformAdmin(opts: { telegramId?: number; userId?: number; role?: string }, adminId: number) {
  let targetUserId = opts.userId ?? null
  if (!targetUserId && opts.telegramId) {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', opts.telegramId).maybeSingle()
    if (!user) return { ok: false as const, reason: 'No user with that Telegram id has logged in yet' }
    targetUserId = user.id
  }
  if (!targetUserId) return { ok: false as const, reason: 'telegramId or userId is required' }

  const { error } = await sb
    .from('platform_admins')
    .upsert({ user_id: targetUserId, role: opts.role ?? 'operator' }, { onConflict: 'user_id' })
  if (error) throw error
  await recordAuditEvent({ actorUserId: adminId, eventType: 'admin_added', payload: { targetUserId, role: opts.role ?? 'operator' } })
  return { ok: true as const, userId: targetUserId }
}

export async function removePlatformAdmin(targetUserId: number, adminId: number) {
  if (targetUserId === adminId) return { ok: false as const, reason: 'You cannot remove yourself' }
  const { count } = await sb.from('platform_admins').select('id', { count: 'exact', head: true })
  if ((count ?? 0) <= 1) return { ok: false as const, reason: 'Cannot remove the last platform admin' }

  const { error } = await sb.from('platform_admins').delete().eq('user_id', targetUserId)
  if (error) throw error
  await recordAuditEvent({ actorUserId: adminId, eventType: 'admin_removed', payload: { targetUserId } })
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function listAuditEvents(filters: { communityId?: number; actorId?: number; type?: string; limit?: number } = {}) {
  let query = sb.from('audit_events').select('id, actor_user_id, community_id, event_type, payload, created_at').order('created_at', { ascending: false })
  if (filters.communityId) query = query.eq('community_id', filters.communityId)
  if (filters.actorId) query = query.eq('actor_user_id', filters.actorId)
  if (filters.type) query = query.eq('event_type', filters.type)
  query = query.limit(Math.min(filters.limit ?? 50, 200))
  const { data: events } = await query

  const rows = events ?? []
  const actorIds = Array.from(new Set(rows.map((r: any) => r.actor_user_id).filter(Boolean))) as number[]
  const communityIds = Array.from(new Set(rows.map((r: any) => r.community_id).filter(Boolean))) as number[]
  const [{ data: actors }, { data: communities }] = await Promise.all([
    actorIds.length ? supabase.from('users').select('id, username, telegram_id').in('id', actorIds) : Promise.resolve({ data: [] as any[] }),
    communityIds.length ? supabase.from('communities').select('id, name').in('id', communityIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const actorMap = new Map((actors ?? []).map((a: any) => [a.id, a.username ?? `user_${a.telegram_id}`]))
  const communityMap = new Map((communities ?? []).map((c: any) => [c.id, c.name]))

  return rows.map((r: any) => ({
    id: r.id,
    actor: r.actor_user_id ? `@${actorMap.get(r.actor_user_id) ?? `user_${r.actor_user_id}`}` : 'system',
    community: r.community_id ? communityMap.get(r.community_id) ?? `#${r.community_id}` : null,
    eventType: r.event_type,
    payload: r.payload ?? {},
    createdAt: r.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Payments oversight (read-only)
// ---------------------------------------------------------------------------

export async function listAdminPayments(filters: { status?: string; communityId?: number; days?: number; limit?: number } = {}) {
  let query = sb
    .from('purchases')
    .select('id, community_id, buyer_user_id, amount_stars, amount_cents, status, source, created_at')
    .order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.communityId) query = query.eq('community_id', filters.communityId)
  if (filters.days) query = query.gte('created_at', new Date(Date.now() - filters.days * 86400000).toISOString())
  query = query.limit(Math.min(filters.limit ?? 50, 200))
  const { data: purchases } = await query

  const rows = purchases ?? []
  const communityIds = Array.from(new Set(rows.map((r: any) => r.community_id).filter(Boolean))) as number[]
  const buyerIds = Array.from(new Set(rows.map((r: any) => r.buyer_user_id).filter(Boolean))) as number[]
  const [{ data: communities }, { data: buyers }] = await Promise.all([
    communityIds.length ? supabase.from('communities').select('id, name').in('id', communityIds) : Promise.resolve({ data: [] as any[] }),
    buyerIds.length ? supabase.from('users').select('id, username, telegram_id').in('id', buyerIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const communityMap = new Map((communities ?? []).map((c: any) => [c.id, c.name]))
  const buyerMap = new Map((buyers ?? []).map((b: any) => [b.id, b.username ?? `user_${b.telegram_id}`]))

  return rows.map((p: any) => ({
    id: p.id,
    community: communityMap.get(p.community_id) ?? `#${p.community_id}`,
    buyer: `@${buyerMap.get(p.buyer_user_id) ?? 'member'}`,
    stars: p.amount_stars ?? 0,
    amountCents: p.amount_cents ?? 0,
    status: p.status,
    source: p.source ?? null,
    createdAt: p.created_at,
  }))
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function adminSearch(q: string) {
  const term = q.trim()
  if (!term) return { communities: [], users: [], payments: [] }
  const like = `%${term}%`
  const asNumber = Number(term)
  const isNumeric = Number.isFinite(asNumber)

  const [communitiesRes, usersRes, paymentsRes] = await Promise.all([
    sb.from('communities').select('id, name, handle, status, owner_id').or(`name.ilike.${like},handle.ilike.${like}`).limit(20),
    isNumeric
      ? supabase.from('users').select('id, username, telegram_id').or(`telegram_id.eq.${asNumber},id.eq.${asNumber}`).limit(20)
      : supabase.from('users').select('id, username, telegram_id').ilike('username', like).limit(20),
    isNumeric
      ? sb.from('purchases').select('id, community_id, buyer_user_id, amount_stars, status, created_at').eq('id', asNumber).limit(20)
      : Promise.resolve({ data: [] as any[] }),
  ])

  return {
    communities: (communitiesRes.data ?? []).map((c: any) => ({ id: c.id, name: c.name, handle: c.handle, status: c.status })),
    users: (usersRes.data ?? []).map((u: any) => ({ id: u.id, username: u.username, telegramId: u.telegram_id })),
    payments: (paymentsRes.data ?? []).map((p: any) => ({
      id: p.id,
      communityId: p.community_id,
      buyerUserId: p.buyer_user_id,
      stars: p.amount_stars,
      status: p.status,
      createdAt: p.created_at,
    })),
  }
}
