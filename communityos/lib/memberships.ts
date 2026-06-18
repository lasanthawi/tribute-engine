import { MembershipPlanRow, supabase } from './supabase'
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
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled' = 'active'
) {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { data, error } = await supabase
    .from('member_subscriptions')
    .insert({
      community_id: communityId,
      user_id: userId,
      plan_id: planId,
      status,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      payment_provider: 'manual',
    })
    .select('*')
    .single()
  if (error) throw error

  if (status === 'active') {
    await creditCommunityXp(communityId, userId, 40, 'membership_active', { metadata: { planId } })
  }

  return data
}
