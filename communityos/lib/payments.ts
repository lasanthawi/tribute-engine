import { sb } from './supabase'
import { creditCommunityXp } from './xp'
import { evaluateRewardRules } from './reward-rules'
import { signedAssetUrl } from './assets'
import { ensureMember } from './communities'
import { createOrUpdateSubscription, createSubscriptionPeriod } from './memberships'
import { STAR_TO_CENTS, starsToCents } from './star-rate'
import type { PurchaseDto } from './api-client'

export { STAR_TO_CENTS, starsToCents }

export type ProductType = 'course' | 'download' | 'premium_content' | 'consultation'

export interface CreateProductInput {
  title: string
  type?: ProductType
  priceStars?: number
  status?: 'draft' | 'active'
  description?: string
  buttonText?: string
  coverPath?: string | null
  deliveryType?: 'file' | 'url' | 'text' | 'none'
  deliveryText?: string
  deliveryUrl?: string
  filePath?: string | null
  fileName?: string | null
}

export async function listProducts(communityId: number, userId?: number) {
  const { data: products, error } = await sb
    .from('payment_products')
    .select('*')
    .eq('community_id', communityId)
    .neq('status', 'archived')
    .order('id', { ascending: true })
  if (error) throw error

  const ids = (products ?? []).map((p: any) => p.id)
  const { data: purchases } = ids.length
    ? await sb.from('purchases').select('product_id').eq('community_id', communityId).eq('status', 'paid').in('product_id', ids)
    : { data: [] }

  const counts = new Map<number, number>()
  for (const row of purchases ?? []) counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)

  const { data: userPurchases } =
    userId && ids.length
      ? await sb.from('purchases').select('product_id').eq('community_id', communityId).eq('buyer_user_id', userId).eq('status', 'paid').in('product_id', ids)
      : { data: [] }
  const owned = new Set((userPurchases ?? []).map((row: any) => row.product_id))

  return Promise.all(
    (products ?? []).map(async (product: any) => {
      const metadata = product.metadata ?? {}
      const isOwned = owned.has(product.id)
      return {
        id: product.id,
        title: product.title,
        type: product.product_type as ProductType,
        description: metadata.description ?? null,
        buttonText: metadata.buttonText ?? null,
        status: product.status as 'draft' | 'active',
        purchases: counts.get(product.id) ?? 0,
        priceStars: product.price_stars,
        coverUrl: await signedAssetUrl(metadata.coverPath, 86400),
        deliveryType: metadata.deliveryType ?? 'none',
        deliveryText: isOwned ? metadata.deliveryText ?? null : null,
        deliveryUrl: isOwned ? metadata.deliveryUrl ?? (await signedAssetUrl(metadata.filePath, 900)) : null,
        fileName: metadata.fileName ?? null,
        owned: isOwned,
      }
    })
  )
}

export async function createProduct(communityId: number, input: CreateProductInput) {
  const { data, error } = await sb
    .from('payment_products')
    .insert({
      community_id: communityId,
      title: input.title,
      product_type: input.type ?? 'download',
      price_stars: Math.max(0, Math.round(input.priceStars ?? 0)),
      status: input.status ?? 'draft',
      metadata: {
        description: input.description ?? '',
        buttonText: input.buttonText ?? 'Buy',
        coverPath: input.coverPath ?? null,
        deliveryType: input.deliveryType ?? 'none',
        deliveryText: input.deliveryText ?? '',
        deliveryUrl: input.deliveryUrl ?? '',
        filePath: input.filePath ?? null,
        fileName: input.fileName ?? null,
      },
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.product_type as ProductType,
    description: data.metadata?.description ?? null,
    buttonText: data.metadata?.buttonText ?? null,
    status: data.status as 'draft' | 'active',
    purchases: 0,
    priceStars: data.price_stars,
    coverUrl: await signedAssetUrl(data.metadata?.coverPath, 86400),
    deliveryType: data.metadata?.deliveryType ?? 'none',
    deliveryText: null,
    deliveryUrl: null,
    fileName: data.metadata?.fileName ?? null,
    owned: false,
  }
}

export async function archiveProduct(communityId: number, productId: number) {
  const { data, error } = await sb
    .from('payment_products')
    .update({ status: 'archived' })
    .eq('community_id', communityId)
    .eq('id', productId)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.product_type as ProductType,
    description: data.metadata?.description ?? null,
    buttonText: data.metadata?.buttonText ?? null,
    status: data.status,
    purchases: 0,
    priceStars: data.price_stars,
    coverUrl: await signedAssetUrl(data.metadata?.coverPath, 86400),
    deliveryType: data.metadata?.deliveryType ?? 'none',
    deliveryText: null,
    deliveryUrl: null,
    fileName: data.metadata?.fileName ?? null,
    owned: false,
  }
}

export async function unlockFreeProduct(communityId: number, userId: number, productId: number) {
  const products = await listProducts(communityId, userId)
  const product = products.find((item) => item.id === productId)
  if (!product) return { ok: false as const, reason: 'Product not found' }
  if (product.owned) return { ok: true as const, product }
  if (product.priceStars > 0) return { ok: false as const, reason: 'Payment required' }

  const { data: existing } = await sb
    .from('purchases')
    .select('id')
    .eq('community_id', communityId)
    .eq('buyer_user_id', userId)
    .eq('product_id', productId)
    .eq('status', 'paid')
    .maybeSingle()

  if (!existing?.id) {
    await sb.from('purchases').insert({
      community_id: communityId,
      buyer_user_id: userId,
      product_id: productId,
      amount_stars: 0,
      amount_cents: 0,
      status: 'paid',
      source: 'free_unlock',
      paid_at: new Date().toISOString(),
    })
    await sb.from('community_activity_events').insert({
      community_id: communityId,
      user_id: userId,
      event_type: 'product_unlocked',
      title: `Unlocked ${product.title}`,
      metadata: { productId },
    })
    await creditCommunityXp(communityId, userId, 15, 'product_unlock', { metadata: { productId } })
  }

  const [unlocked] = (await listProducts(communityId, userId)).filter((item) => item.id === productId)
  return { ok: true as const, product: unlocked ?? { ...product, owned: true } }
}

export async function listMemberPurchases(communityId: number, userId: number): Promise<PurchaseDto[]> {
  const { data: purchases, error } = await sb
    .from('purchases')
    .select('*')
    .eq('community_id', communityId)
    .eq('buyer_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error

  const productIds = Array.from(new Set((purchases ?? []).map((row: any) => row.product_id).filter((id: unknown): id is number => typeof id === 'number')))
  const eventIds = Array.from(new Set((purchases ?? []).map((row: any) => row.event_id).filter((id: unknown): id is number => typeof id === 'number')))
  const planIds = Array.from(new Set((purchases ?? []).map((row: any) => row.plan_id).filter((id: unknown): id is number => typeof id === 'number')))

  const [{ data: products }, { data: events }, { data: plans }] = await Promise.all([
    productIds.length ? sb.from('payment_products').select('id, title').in('id', productIds) : Promise.resolve({ data: [] }),
    eventIds.length ? sb.from('community_events').select('id, title').in('id', eventIds) : Promise.resolve({ data: [] }),
    planIds.length ? sb.from('membership_plans').select('id, name').in('id', planIds) : Promise.resolve({ data: [] }),
  ])

  const productMap = new Map((products ?? []).map((row: any) => [row.id, row.title]))
  const eventMap = new Map((events ?? []).map((row: any) => [row.id, row.title]))
  const planMap = new Map((plans ?? []).map((row: any) => [row.id, row.name]))

  return ((purchases ?? []) as any[]).map((row) => {
    const kind: PurchaseDto['kind'] = row.plan_id ? 'membership' : row.product_id ? 'product' : row.event_id ? 'event' : 'stars'
    const title = String(
      row.plan_id ? planMap.get(row.plan_id) ?? 'Membership' :
      row.product_id ? productMap.get(row.product_id) ?? 'Product' :
      row.event_id ? eventMap.get(row.event_id) ?? 'Event' :
      'Stars purchase'
    )
    return {
      id: row.id,
      kind,
      title,
      amountStars: row.amount_stars ?? 0,
      amountCents: row.amount_cents ?? 0,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    }
  })
}

export interface CreateInvoiceInput {
  title: string
  description?: string
  stars: number
  kind?: 'plan' | 'product' | 'event'
  planId?: number | null
  productId?: number | null
  eventId?: number | null
  buyerUserId?: number | null
  interval?: string | null
}

export async function createInvoice(communityId: number, input: CreateInvoiceInput) {
  const stars = Math.max(1, Math.round(input.stars))
  const invoiceKind = input.eventId ? `event_${input.eventId}` : input.productId ? `product_${input.productId}` : input.planId ? `plan_${input.planId}` : 'plan'
  const kind = input.kind ?? (input.eventId ? 'event' : input.productId ? 'product' : 'plan')
  const payload = `co:${communityId}:${invoiceKind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  const invoiceRow: Record<string, unknown> = {
    community_id: communityId,
    invoice_kind: kind,
    plan_id: input.planId ?? null,
    product_id: input.productId ?? null,
    event_id: input.eventId ?? null,
    buyer_user_id: input.buyerUserId ?? null,
    period_interval: input.interval ?? null,
    payload,
    stars,
    status: 'created',
  }
  let { error } = await sb.from('telegram_star_invoices').insert(invoiceRow)
  if (error) {
    delete invoiceRow.event_id
    delete invoiceRow.plan_id
    delete invoiceRow.invoice_kind
    delete invoiceRow.period_interval
    const fallback = await sb.from('telegram_star_invoices').insert(invoiceRow)
    error = fallback.error
  }
  if (error) throw error

  return {
    title: input.title,
    description: input.description ?? 'Telegram Stars purchase for CommunityOS.',
    payload,
    currency: 'XTR',
    prices: [{ label: input.title, amount: stars }],
  }
}

export async function findInvoiceByPayload(payload: string) {
  const { data, error } = await sb.from('telegram_star_invoices').select('*').eq('payload', payload).maybeSingle()
  if (error) throw error
  return data
}

export interface SuccessfulPaymentInput {
  payload: string
  stars: number
  buyerUserId: number
  telegramChargeId?: string | null
  providerChargeId?: string | null
}

// Reconciles a confirmed Telegram Stars payment: marks the invoice paid, records
// the purchase, attributes revenue to a referral if one exists, and credits XP.
export async function recordSuccessfulPayment(input: SuccessfulPaymentInput) {
  const invoice = await findInvoiceByPayload(input.payload)
  if (!invoice) return { ok: false as const, reason: 'Unknown invoice payload' }

  const communityId = invoice.community_id as number
  const parsedEventId = /^co:\d+:event_(\d+):/.exec(String(input.payload))?.[1]
  const parsedPlanId = /^co:\d+:plan_(\d+):/.exec(String(input.payload))?.[1]
  const parsedProductId = /^co:\d+:product_(\d+):/.exec(String(input.payload))?.[1]
  const eventId = invoice.event_id ?? (parsedEventId ? Number(parsedEventId) : null)
  const planId = invoice.plan_id ?? (parsedPlanId ? Number(parsedPlanId) : null)
  const productId = invoice.product_id ?? (parsedProductId ? Number(parsedProductId) : null)

  if (invoice.status === 'paid') {
    return {
      ok: true as const,
      alreadyPaid: true,
      communityId,
      planId,
      productId,
      eventId,
    }
  }

  const amountCents = starsToCents(input.stars)
  await ensureMember(communityId, input.buyerUserId, { accessStatus: planId ? 'granted' : 'pending', source: 'telegram_stars' })

  await sb
    .from('telegram_star_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      buyer_user_id: input.buyerUserId,
      telegram_charge_id: input.telegramChargeId ?? null,
      provider_charge_id: input.providerChargeId ?? null,
    })
    .eq('id', invoice.id)

  const purchaseRow: Record<string, unknown> = {
    community_id: communityId,
    buyer_user_id: input.buyerUserId,
    plan_id: planId,
    product_id: productId,
    event_id: eventId,
    invoice_id: invoice.id,
    amount_stars: input.stars,
    amount_cents: amountCents,
    status: 'paid',
    source: 'telegram_stars',
    paid_at: new Date().toISOString(),
  }
  let purchaseInsert = await sb
    .from('purchases')
    .insert(purchaseRow)
    .select('id')
    .single()
  if (purchaseInsert.error) {
    delete purchaseRow.event_id
    delete purchaseRow.plan_id
    purchaseInsert = await sb.from('purchases').insert(purchaseRow).select('id').single()
  }
  if (purchaseInsert.error) throw purchaseInsert.error
  const purchase = purchaseInsert.data as any

  if (planId) {
    const subscription = (await createOrUpdateSubscription(communityId, input.buyerUserId, planId, 'active', {
      interval: invoice.period_interval ?? 'month',
      paymentProvider: 'telegram_stars',
      paymentReference: input.telegramChargeId ?? input.payload,
    })) as any
    await createSubscriptionPeriod({
      communityId,
      subscriptionId: subscription.id,
      purchaseId: purchase?.id ?? null,
      startsAt: subscription.current_period_start,
      endsAt: subscription.current_period_end,
      status: 'active',
    })
    await sb.from('renewal_events').insert({
      community_id: communityId,
      member_subscription_id: subscription.id,
      status: 'paid',
      message: `Subscription activated with ${input.stars} XTR.`,
    })
  }

  await sb.from('community_balance_ledger').insert({
    community_id: communityId,
    user_id: input.buyerUserId,
    purchase_id: purchase?.id ?? null,
    entry_type: planId ? 'membership_payment' : eventId ? 'event_payment' : productId ? 'product_payment' : 'stars_payment',
    stars_delta: input.stars,
    cents_delta: amountCents,
    status: 'available',
  })

  if (eventId) {
    const member = (await ensureMember(communityId, input.buyerUserId, { accessStatus: 'pending', source: 'event_payment' })) as any
    if (member?.id) {
      await sb
        .from('event_registrations')
        .upsert({ event_id: eventId, member_id: member.id, status: 'registered' }, { onConflict: 'event_id,member_id' })
    }
  }

  // Attribute revenue to the most recent referral that referred this buyer.
  const { data: attribution } = await sb
    .from('referral_attributions')
    .select('referral_id')
    .eq('community_id', communityId)
    .eq('referred_user_id', input.buyerUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (attribution?.referral_id) {
    await sb.from('revenue_attributions').insert({
      community_id: communityId,
      referral_id: attribution.referral_id,
      purchase_id: purchase?.id ?? null,
      revenue_cents: amountCents,
      revenue_stars: input.stars,
    })
    await sb
      .from('community_referrals')
      .update({ status: 'purchased' })
      .eq('id', attribution.referral_id)
  }

  await sb.from('community_activity_events').insert({
    community_id: communityId,
    user_id: input.buyerUserId,
    event_type: 'purchase',
    title: `Stars purchase confirmed (${input.stars} XTR)`,
  })

  await creditCommunityXp(communityId, input.buyerUserId, 50, 'purchase', { metadata: { stars: input.stars } })
  await evaluateRewardRules(communityId, input.buyerUserId, 'purchase_completed').catch((error) =>
    console.error('evaluateRewardRules(purchase_completed) failed:', error)
  )

  return {
    ok: true as const,
    communityId,
    purchaseId: purchase?.id ?? null,
    planId,
    productId,
    eventId,
  }
}

export async function listInvoices(communityId: number, limit = 20) {
  const { data, error } = await sb
    .from('telegram_star_invoices')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}
