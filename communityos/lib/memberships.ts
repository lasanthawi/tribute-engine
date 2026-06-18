import { MembershipPlanRow, sb, supabase } from './supabase'
import { creditCommunityXp } from './xp'

export interface CreatePlanInput {
  name: string
  description?: string | null
  priceCents?: number
  currency?: string
  interval?: string
  benefits?: unknown[]
}

export async function listPlans(communityId: number) {
  const { data: plans, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('community_id', communityId)
    .neq('status', 'archived')
    .order('price_cents', { ascending: true })
  if (error) throw error

  const { data: subscriptions, error: subErr } = await supabase
    .from('member_subscriptions')
    .select('plan_id')
    .eq('community_id', communityId)
    .eq('status', 'active')
  if (subErr) throw subErr

  const subscriberCounts = new Map<number, number>()
  for (const sub of subscriptions ?? []) {
    if (sub.plan_id) subscriberCounts.set(sub.plan_id, (subscriberCounts.get(sub.plan_id) ?? 0) + 1)
  }

  return ((plans ?? []) as MembershipPlanRow[]).map((plan) => ({ ...plan, subscribers: subscriberCounts.get(plan.id) ?? 0 }))
}

export async function createPlan(communityId: number, input: CreatePlanInput) {
  const { data, error } = await supabase
    .from('membership_plans')
    .insert({
      community_id: communityId,
      name: input.name,
      description: input.description ?? null,
      price_cents: input.priceCents ?? 0,
      currency: input.currency ?? 'USD',
      interval: input.interval ?? 'month',
      benefits: input.benefits ?? [],
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as MembershipPlanRow
}

export async function archivePlan(communityId: number, planId: number) {
  const { data, error } = await supabase
    .from('membership_plans')
    .update({ status: 'archived' })
    .eq('community_id', communityId)
    .eq('id', planId)
    .select('*')
    .single()
  if (error) throw error
  return data as MembershipPlanRow
}

export async function createOrUpdateSubscription(
  communityId: number,
  userId: number,
  planId: number | null,
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled' = 'active',
  opts: { interval?: string; paymentReference?: string | null; paymentProvider?: string } = {}
) {
  const now = new Date()
  const periodEnd = new Date(now)
  const interval = opts.interval ?? 'month'
  if (interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  else if (interval === 'lifetime') periodEnd.setFullYear(periodEnd.getFullYear() + 100)
  else periodEnd.setMonth(periodEnd.getMonth() + 1)

  let existingQuery = supabase
    .from('member_subscriptions')
    .select('*')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  existingQuery = planId === null ? existingQuery.is('plan_id', null) : existingQuery.eq('plan_id', planId)
  const { data: existingRow } = await existingQuery.maybeSingle()
  const existing = existingRow as { id?: number } | null

  const payload = {
    community_id: communityId,
    user_id: userId,
    plan_id: planId,
    status,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    payment_provider: opts.paymentProvider ?? 'manual',
    payment_reference: opts.paymentReference ?? null,
    updated_at: now.toISOString(),
  }

  const result = existing?.id
    ? await supabase.from('member_subscriptions').update(payload).eq('id', existing.id).select('*').single()
    : await supabase
    .from('member_subscriptions')
    .insert({
      ...payload,
    })
    .select('*')
    .single()
  const { data, error } = result as { data: any; error: any }
  if (error) throw error

  if (status === 'active') {
    await creditCommunityXp(communityId, userId, 40, 'membership_active', { metadata: { planId } })
  }

  return data
}

export async function createSubscriptionPeriod(opts: {
  communityId: number
  subscriptionId: number
  purchaseId?: number | null
  startsAt: string
  endsAt: string | null
  status?: string
}) {
  const { data, error } = await sb
    .from('subscription_periods')
    .insert({
      community_id: opts.communityId,
      member_subscription_id: opts.subscriptionId,
      purchase_id: opts.purchaseId ?? null,
      starts_at: opts.startsAt,
      ends_at: opts.endsAt,
      status: opts.status ?? 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function expirePastDueSubscriptions(communityId?: number) {
  const now = new Date().toISOString()
  let query = supabase
    .from('member_subscriptions')
    .select('id, community_id, user_id, current_period_end, status')
    .in('status', ['active', 'past_due'])
    .not('current_period_end', 'is', null)
    .lt('current_period_end', now)
    .limit(100)
  if (communityId) query = query.eq('community_id', communityId)
  const { data, error } = await query
  if (error) throw error

  let expired = 0
  for (const sub of data ?? []) {
    await supabase.from('member_subscriptions').update({ status: 'expired', updated_at: now }).eq('id', sub.id)
    await supabase
      .from('community_members')
      .update({ access_status: 'expired' })
      .eq('community_id', sub.community_id)
      .eq('user_id', sub.user_id)
    await sb.from('renewal_events').insert({
      community_id: sub.community_id,
      member_subscription_id: sub.id,
      status: 'expired',
      message: 'Subscription period ended and access was marked expired.',
    })
    expired++
  }
  return { scanned: data?.length ?? 0, expired }
}
