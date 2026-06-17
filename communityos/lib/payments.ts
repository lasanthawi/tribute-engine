import { sb } from './supabase'
import { creditCommunityXp } from './xp'

// Telegram Stars are priced 1:1 in the invoice; we persist an approximate cash
// value so revenue rolls up alongside manual/fiat plans. ~1 Star ≈ $0.013.
export const STAR_TO_CENTS = 1.3

export function starsToCents(stars: number): number {
  return Math.round(stars * STAR_TO_CENTS)
}

export type ProductType = 'course' | 'download' | 'premium_content' | 'consultation'

export interface CreateProductInput {
  title: string
  type?: ProductType
  priceStars?: number
  status?: 'draft' | 'active'
}

export async function listProducts(communityId: number) {
  const { data: products, error } = await sb
    .from('payment_products')
    .select('*')
    .eq('community_id', communityId)
    .order('id', { ascending: true })
  if (error) throw error

  const ids = (products ?? []).map((p: any) => p.id)
  const { data: purchases } = ids.length
    ? await sb.from('purchases').select('product_id').eq('community_id', communityId).eq('status', 'paid').in('product_id', ids)
    : { data: [] }

  const counts = new Map<number, number>()
  for (const row of purchases ?? []) counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1)

  return (products ?? []).map((product: any) => ({
    id: product.id,
    title: product.title,
    type: product.product_type as ProductType,
    status: product.status as 'draft' | 'active',
    purchases: counts.get(product.id) ?? 0,
    priceStars: product.price_stars,
  }))
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
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.product_type as ProductType,
    status: data.status as 'draft' | 'active',
    purchases: 0,
    priceStars: data.price_stars,
  }
}

export interface CreateInvoiceInput {
  title: string
  description?: string
  stars: number
  productId?: number | null
  buyerUserId?: number | null
}

export async function createInvoice(communityId: number, input: CreateInvoiceInput) {
  const stars = Math.max(1, Math.round(input.stars))
  const payload = `co:${communityId}:${input.productId ?? 'plan'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  const { error } = await sb.from('telegram_star_invoices').insert({
    community_id: communityId,
    product_id: input.productId ?? null,
    buyer_user_id: input.buyerUserId ?? null,
    payload,
    stars,
    status: 'created',
  })
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
  if (invoice.status === 'paid') return { ok: true as const, alreadyPaid: true }

  const communityId = invoice.community_id as number
  const amountCents = starsToCents(input.stars)

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

  const { data: purchase } = await sb
    .from('purchases')
    .insert({
      community_id: communityId,
      buyer_user_id: input.buyerUserId,
      product_id: invoice.product_id ?? null,
      invoice_id: invoice.id,
      amount_stars: input.stars,
      amount_cents: amountCents,
      status: 'paid',
      source: 'telegram_stars',
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single()

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

  return { ok: true as const, communityId, purchaseId: purchase?.id ?? null }
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
