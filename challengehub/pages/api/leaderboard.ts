import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getLeaderboard, LeaderboardScope } from '@/lib/leaderboard'

const VALID_SCOPES: LeaderboardScope[] = ['challenge', 'community', 'global']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const scopeParam = req.query.scope
  const scope: LeaderboardScope =
    typeof scopeParam === 'string' && VALID_SCOPES.includes(scopeParam as LeaderboardScope)
      ? (scopeParam as LeaderboardScope)
      : 'global'

  const challengeIdParam = req.query.challengeId
  const challengeId = typeof challengeIdParam === 'string' ? Number(challengeIdParam) : undefined

  if (scope === 'challenge' && (challengeId === undefined || Number.isNaN(challengeId))) {
    return res.status(400).json({ error: 'challengeId is required for scope=challenge' })
  }

  try {
    const result = await getLeaderboard(scope, userId, challengeId)
    res.status(200).json(result)
  } catch (error) {
    console.error('leaderboard error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
