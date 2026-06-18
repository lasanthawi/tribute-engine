import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { createInvoice } from '@/lib/payments'
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
  const productId = typeof req.body?.productId === 'number' ? req.body.productId : null
  const eventId = typeof req.body?.eventId === 'number' ? req.body.eventId : null

  try {
    const invoice = await createInvoice(communityId, {
      title,
      description: req.body?.description,
      stars,
      productId,
      eventId,
      buyerUserId: userId,
    })
    const invoiceLink = await createTelegramInvoiceLink(process.env.TELEGRAM_BOT_TOKEN || '', invoice).catch((error) => {
      console.error('createInvoiceLink failed:', error)
      return null
    })
    res.status(200).json({ invoice: { ...invoice, invoiceLink } })
  } catch (error) {
    console.error('communities/[id]/payments/invoices error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
