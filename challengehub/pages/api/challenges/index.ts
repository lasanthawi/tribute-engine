import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { listChallenges } from '@/lib/challenges'
import { supabase } from '@/lib/supabase'
import { ChallengeStatus } from '@/lib/supabase'

const VALID_STATUSES: ChallengeStatus[] = ['upcoming', 'active', 'completed', 'cancelled']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const statusParam = req.query.status
    const status =
      typeof statusParam === 'string' && VALID_STATUSES.includes(statusParam as ChallengeStatus)
        ? (statusParam as ChallengeStatus)
        : undefined

    const challenges = await listChallenges(status)

    const challengeIds = challenges.map((c) => c.id)
    const { data: memberships } = challengeIds.length
      ? await supabase
          .from('challenge_members')
          .select('challenge_id, status')
          .eq('user_id', userId)
          .in('challenge_id', challengeIds)
      : { data: [] as { challenge_id: number; status: string }[] }

    const membershipMap = new Map((memberships ?? []).map((m) => [m.challenge_id, m.status]))

    const { data: memberCounts } = challengeIds.length
      ? await supabase.from('challenge_members').select('challenge_id').in('challenge_id', challengeIds)
      : { data: [] as { challenge_id: number }[] }

    const countMap = new Map<number, number>()
    for (const row of memberCounts ?? []) {
      countMap.set(row.challenge_id, (countMap.get(row.challenge_id) ?? 0) + 1)
    }

    res.status(200).json({
      challenges: challenges.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverUrl: c.cover_url,
        category: c.category,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
        rules: c.rules,
        rewards: c.rewards,
        memberCount: countMap.get(c.id) ?? 0,
        isMember: membershipMap.has(c.id),
        membershipStatus: membershipMap.get(c.id) ?? null,
      })),
    })
  } catch (error) {
    console.error('challenges/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
