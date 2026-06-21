import { getCommunityMetrics } from './analytics'
import { sb, supabase } from './supabase'
import type { AdminDashboardDto } from './api-client'

type AuditInput = {
  actorUserId?: number | null
  communityId?: number | null
  eventType: string
  payload?: Record<string, unknown>
}

function bootstrapAdminTelegramIds(): number[] {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0)
}

// First-admin bootstrap: ADMIN_TELEGRAM_IDS has no other way into platform_admins
// (every other admin-management path already requires being a platform admin), so
// a matching login auto-seeds the row. Documented in .env.example.
export async function isPlatformAdmin(userId: number): Promise<boolean> {
  const { data, error } = await sb.from('platform_admins').select('id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return true

  const bootstrapIds = bootstrapAdminTelegramIds()
  if (!bootstrapIds.length) return false

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle()
  if (!user || !bootstrapIds.includes(user.telegram_id)) return false

  const { error: seedError } = await sb.from('platform_admins').upsert({ user_id: userId, role: 'owner' }, { onConflict: 'user_id' })
  if (seedError) throw seedError
  return true
}

export async function recordAuditEvent(input: AuditInput): Promise<void> {
  const { error } = await sb.from('audit_events').insert({
    actor_user_id: input.actorUserId ?? null,
    community_id: input.communityId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
  })
  if (error) throw error
}

export async function listPlatformAdmins() {
  const { data, error } = await sb
    .from('platform_admins')
    .select('id, user_id, role, created_at, users(id, telegram_id, username)')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    telegramId: row.users?.telegram_id ?? null,
    username: row.users?.username ?? null,
    role: row.role,
    createdAt: row.created_at,
  }))
}

export async function addPlatformAdmin(
  input: { telegramId?: number; userId?: number; role?: string },
  actorUserId: number
) {
  let userId = input.userId

  if (!userId && input.telegramId) {
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', input.telegramId)
      .maybeSingle()
    if (existingError) throw existingError

    if (existing) {
      userId = existing.id
    } else {
      const { data: created, error: createError } = await supabase
        .from('users')
        .insert({ telegram_id: input.telegramId })
        .select('id')
        .single()
      if (createError) throw createError
      userId = created.id
    }
  }

  if (!userId) return { ok: false, error: 'telegramId or userId is required' }

  const role = input.role || 'operator'
  const { data, error } = await sb
    .from('platform_admins')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
    .select('id, user_id, role, created_at')
    .single()
  if (error) throw error

  await recordAuditEvent({
    actorUserId,
    eventType: 'platform_admin_added',
    payload: { userId, role },
  })

  return { ok: true, admin: { id: data.id, userId: data.user_id, role: data.role, createdAt: data.created_at } }
}

export async function removePlatformAdmin(userId: number, actorUserId: number) {
  if (userId === actorUserId) return { ok: false, error: 'You cannot remove your own platform admin access' }

  const { error } = await sb.from('platform_admins').delete().eq('user_id', userId)
  if (error) throw error

  await recordAuditEvent({
    actorUserId,
    eventType: 'platform_admin_removed',
    payload: { userId },
  })

  return { ok: true }
}

export async function listAuditEvents(filters: { communityId?: number; actorId?: number; type?: string } = {}) {
  let query: any = sb
    .from('audit_events')
    .select('id, actor_user_id, community_id, event_type, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.communityId) query = query.eq('community_id', filters.communityId)
  if (filters.actorId) query = query.eq('actor_user_id', filters.actorId)
  if (filters.type) query = query.eq('event_type', filters.type)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((event: any) => ({
    id: event.id,
    actorUserId: event.actor_user_id,
    communityId: event.community_id,
    eventType: event.event_type,
    payload: event.payload ?? {},
    createdAt: event.created_at,
  }))
}

export async function resolveAccessIssue(logId: number, actorUserId: number) {
  const { data: log, error: readError } = await supabase
    .from('telegram_access_logs')
    .select('id, community_id, user_id, action, status, message')
    .eq('id', logId)
    .maybeSingle()
  if (readError) throw readError
  if (!log) return { ok: false, error: 'Access issue not found' }

  const { error } = await supabase
    .from('telegram_access_logs')
    .update({ status: 'resolved', message: log.message ?? 'Resolved by platform admin' })
    .eq('id', logId)
  if (error) throw error

  await recordAuditEvent({
    actorUserId,
    communityId: log.community_id,
    eventType: 'access_issue_resolved',
    payload: { logId, userId: log.user_id, action: log.action },
  })

  return { ok: true, logId }
}

export async function listAdminPayments(filters: { status?: string; communityId?: number; days?: number } = {}) {
  let query: any = sb
    .from('purchases')
    .select('id, community_id, buyer_user_id, product_id, invoice_id, amount_stars, amount_cents, status, source, created_at, paid_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.communityId) query = query.eq('community_id', filters.communityId)
  if (filters.days) {
    const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const communityIds: number[] = Array.from(
    new Set(rows.map((p: any) => p.community_id).filter((id: unknown): id is number => typeof id === 'number'))
  )
  const buyerIds: number[] = Array.from(
    new Set(rows.map((p: any) => p.buyer_user_id).filter((id: unknown): id is number => typeof id === 'number'))
  )

  const { data: communities } = communityIds.length
    ? await supabase.from('communities').select('id, name').in('id', communityIds)
    : { data: [] as Array<{ id: number; name: string }> }
  const { data: buyers } = buyerIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', buyerIds)
    : { data: [] as Array<{ id: number; username: string | null; telegram_id: number }> }

  const communityMap = new Map((communities ?? []).map((c) => [c.id, c.name]))
  const buyerMap = new Map((buyers ?? []).map((b) => [b.id, b.username ?? `user_${b.telegram_id}`]))

  return rows.map((p: any) => ({
    id: p.id,
    communityId: p.community_id,
    community: communityMap.get(p.community_id) ?? `#${p.community_id}`,
    buyerUserId: p.buyer_user_id,
    buyer: buyerMap.get(p.buyer_user_id) ? `@${buyerMap.get(p.buyer_user_id)}` : null,
    productId: p.product_id,
    invoiceId: p.invoice_id,
    stars: p.amount_stars,
    amountCents: p.amount_cents,
    status: p.status,
    source: p.source,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }))
}

export async function adminSearch(q: string) {
  const term = q.trim()
  if (!term) return { communities: [], users: [], payments: [] }

  const [{ data: communities }, { data: users }] = await Promise.all([
    supabase
      .from('communities')
      .select('id, name, handle, status, owner_id')
      .or(`name.ilike.%${term}%,handle.ilike.%${term}%`)
      .limit(10),
    supabase
      .from('users')
      .select('id, username, telegram_id')
      .or(Number.isFinite(Number(term)) ? `username.ilike.%${term}%,telegram_id.eq.${Number(term)}` : `username.ilike.%${term}%`)
      .limit(10),
  ])

  return {
    communities: communities ?? [],
    users: users ?? [],
    payments: Number.isFinite(Number(term)) ? await listAdminPayments({ communityId: Number(term) }) : [],
  }
}

export async function getAdminCommunityDetail(communityId: number) {
  const { data: community, error } = await supabase
    .from('communities')
    .select('id, name, handle, description, status, owner_id, telegram_invite_url, settings, created_at, updated_at')
    .eq('id', communityId)
    .maybeSingle()
  if (error) throw error
  if (!community) return null

  const [metrics, plans, members, chats, payments, accessLogs, auditEvents] = await Promise.all([
    getCommunityMetrics(communityId),
    supabase.from('membership_plans').select('id, name, price_cents, currency, interval, status, created_at').eq('community_id', communityId),
    supabase
      .from('community_members')
      .select('id, user_id, role, access_status, source, joined_at, users(id, username, telegram_id)')
      .eq('community_id', communityId)
      .limit(100),
    sb.from('telegram_chats').select('id, title, handle, chat_type, bot_status, access_mode, active_members').eq('community_id', communityId),
    listAdminPayments({ communityId }),
    supabase
      .from('telegram_access_logs')
      .select('id, user_id, action, status, message, created_at')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(50),
    listAuditEvents({ communityId }),
  ])

  return {
    community,
    metrics,
    plans: plans.data ?? [],
    members: members.data ?? [],
    chats: chats.data ?? [],
    payments,
    accessLogs: accessLogs.data ?? [],
    auditEvents,
  }
}

export async function setCommunityStatus(
  communityId: number,
  status: 'active' | 'paused' | 'archived',
  actorUserId: number
) {
  const { data, error } = await supabase
    .from('communities')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .select('id, status')
    .single()
  if (error) throw error

  await recordAuditEvent({
    actorUserId,
    communityId,
    eventType: 'community_status_changed',
    payload: { status },
  })

  return { community: data }
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
