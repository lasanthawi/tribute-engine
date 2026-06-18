import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { markCommunityOSOnboarded } from '@/lib/account'

const allowedModels = new Set(['membership', 'product', 'event', 'referral', 'ai'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const model = typeof req.body?.revenueModel === 'string' && allowedModels.has(req.body.revenueModel) ? req.body.revenueModel : null
    await markCommunityOSOnboarded(userId, model)
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('me/onboarding error:', error)
    return res.status(500).json({ error: 'Internal error' })
  }
}
