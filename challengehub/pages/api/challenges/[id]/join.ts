import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getChallenge, joinChallenge } from '@/lib/challenges'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const challengeId = Number(req.query.id)
  if (Number.isNaN(challengeId)) return res.status(400).json({ error: 'Invalid challenge id' })

  try {
    const challenge = await getChallenge(challengeId)
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })

    const result = await joinChallenge(userId, challengeId)
    res.status(200).json(result)
  } catch (error) {
    console.error('challenges/[id]/join error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
