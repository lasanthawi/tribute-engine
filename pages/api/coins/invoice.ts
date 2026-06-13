import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { COIN_PACKAGES } from '@/lib/coins'
import { createInvoiceLink } from '@/lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { packageId } = req.body ?? {}
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return res.status(400).json({ error: 'Unknown package' })

  if (isDemoMode()) return res.status(200).json({ url: null })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const url = await createInvoiceLink(
      BOT_TOKEN,
      `${pkg.label} — CALLED IT`,
      'Coins can be spent on extra votes, points, and confidence boosts in CALLED IT.',
      `coins:${userId}:${pkg.id}`,
      pkg.stars
    )
    res.status(200).json({ url })
  } catch (error) {
    console.error('coins/invoice error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
