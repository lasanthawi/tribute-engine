import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { spinWheel } from '@/lib/minigames'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) {
    return res.status(200).json({ segmentIndex: 2, rewardPoints: 50, rewardTickets: 0, rewardCoins: 0, remainingPlays: 0 })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const result = await spinWheel(userId)
    res.status(200).json(result)
  } catch (error: any) {
    if (error?.message === 'No plays remaining') {
      return res.status(400).json({ error: 'Already spun today' })
    }
    console.error('games/spin error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
