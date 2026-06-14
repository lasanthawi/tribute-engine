import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { claimReward } from '@/lib/rewards'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const { rewardId } = req.body ?? {}
  const id = Number(rewardId)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid rewardId' })

  try {
    const result = await claimReward(userId, id)
    if (!result.ok) return res.status(400).json({ error: result.reason })

    res.status(200).json({ ok: true, alreadyClaimed: result.alreadyClaimed, xpAwarded: result.xpAwarded })
  } catch (error) {
    console.error('rewards/claim error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
