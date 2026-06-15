import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getChallenge, getMembership } from '@/lib/challenges'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const challengeId = Number(req.query.id)
  if (Number.isNaN(challengeId)) return res.status(400).json({ error: 'Invalid challenge id' })

  try {
    const challenge = await getChallenge(challengeId)
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })

    const membership = await getMembership(userId, challengeId)

    const { count: memberCount } = await supabase
      .from('challenge_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('challenge_id', challengeId)

    res.status(200).json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        coverUrl: challenge.cover_url,
        category: challenge.category,
        startDate: challenge.start_date,
        endDate: challenge.end_date,
        status: challenge.status,
        rules: challenge.rules,
        rewards: challenge.rewards,
        memberCount: memberCount ?? 0,
        isMember: !!membership,
        membershipStatus: membership?.status ?? null,
      },
    })
  } catch (error) {
    console.error('challenges/[id] error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
