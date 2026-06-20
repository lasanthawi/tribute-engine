import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { recordReferralClick } from '@/lib/referrals'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  const { communityId, referrerId } = req.body ?? {}
  if (!Number.isFinite(communityId) || !Number.isFinite(referrerId)) {
    return res.status(400).json({ error: 'communityId and referrerId are required' })
  }

  try {
    await recordReferralClick(communityId, referrerId)
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('referrals/track error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
