import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { listRewardsForUser } from '@/lib/rewards'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const challengeIdParam = req.query.challengeId
  const challengeId = typeof challengeIdParam === 'string' ? Number(challengeIdParam) : undefined

  try {
    const rewards = await listRewardsForUser(userId, challengeId)
    res.status(200).json({
      rewards: rewards.map((r) => ({
        id: r.id,
        challengeId: r.challenge_id,
        type: r.type,
        title: r.title,
        description: r.description,
        criteria: r.criteria,
        claimed: r.claimed,
        claimedAt: r.claimedAt,
      })),
    })
  } catch (error) {
    console.error('rewards/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
