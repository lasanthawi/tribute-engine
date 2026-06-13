import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { playTapGame, computeTapReward, TAP_GAME_MAX_SCORE } from '@/lib/minigames'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { score } = req.body ?? {}
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  if (isDemoMode()) {
    return res.status(200).json({
      rewardPoints: computeTapReward(Math.min(score, TAP_GAME_MAX_SCORE)),
      remainingPlays: 2,
    })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const result = await playTapGame(userId, score)
    res.status(200).json(result)
  } catch (error: any) {
    if (error?.message === 'No plays remaining') {
      return res.status(400).json({ error: 'No plays remaining today' })
    }
    console.error('games/tap/play error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
