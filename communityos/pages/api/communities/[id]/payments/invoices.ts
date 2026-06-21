import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { ensureMember } from '@/lib/communities'
import { listEvents } from '@/lib/events'
import { listMemberSubscriptions, listPlans } from '@/lib/memberships'
import { createInvoice } from '@/lib/payments'
import { listProducts } from '@/lib/payments'
import { createTelegramInvoiceLink } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  const stars = Math.max(1, Number(req.body?.stars ?? 1))
  const title = String(req.body?.title ?? 'CommunityOS purchase')
  const kind = ['plan', 'product', 'event'].includes(req.body?.kind) ? req.body.kind : undefined
  const planId = typeof req.body?.planId === 'number' ? req.body.planId : null
  const productId = typeof req.body?.productId === 'number' ? req.body.productId : null
  const eventId = typeof req.body?.eventId === 'number' ? req.body.eventId : null
  const interval = typeof req.body?.interval === 'string' ? req.body.interval : null

  try {
    await ensureMember(communityId, userId, { accessStatus: 'pending', source: 'checkout' })

    if (kind === 'plan') {
      if (!planId) return res.status(400).json({ error: 'planId is required' })
      const plan = (await listPlans(communityId)).find((item) => item.id === planId && item.status !== 'archived')
      if (!plan) return res.status(404).json({ error: 'Plan not found' })
      const subscriptions = await listMemberSubscriptions(communityId, userId)
      const activeSubscription = subscriptions.find((item) => item.planId === planId && (item.status === 'active' || item.status === 'trialing'))
      if (activeSubscription) return res.status(409).json({ error: 'Membership already active' })
    }

    if (kind === 'product') {
      if (!productId) return res.status(400).json({ error: 'productId is required' })
      const product = (await listProducts(communityId, userId)).find((item) => item.id === productId && item.status !== 'archived')
      if (!product) return res.status(404).json({ error: 'Product not found' })
      if (product.owned) return res.status(409).json({ error: 'Product already unlocked' })
    }

    if (kind === 'event') {
      if (!eventId) return res.status(400).json({ error: 'eventId is required' })
      const event = (await listEvents(communityId, userId)).find((item) => item.id === eventId)
      if (!event) return res.status(404).json({ error: 'Event not found' })
      if (event.registered) return res.status(409).json({ error: 'Event already registered' })
    }

    const invoice = await createInvoice(communityId, {
      title,
      description: req.body?.description,
      stars,
      kind,
      planId,
      productId,
      eventId,
      interval,
      buyerUserId: userId,
    })
    let invoiceLink: string | null = null
    let invoiceError: string | null = null
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      invoiceError = 'TELEGRAM_BOT_TOKEN is not configured for this bot'
    } else {
      invoiceLink = await createTelegramInvoiceLink(process.env.TELEGRAM_BOT_TOKEN, invoice).catch((error) => {
        console.error('createInvoiceLink failed:', error)
        invoiceError = error?.message || 'Telegram could not create the invoice link'
        return null
      })
    }
    res.status(200).json({ invoice: { ...invoice, invoiceLink, invoiceError } })
  } catch (error) {
    console.error('communities/[id]/payments/invoices error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
