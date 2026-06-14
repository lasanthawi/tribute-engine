import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getChallenge, listTasks, getSubmissionsForUser } from '@/lib/challenges'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const challengeId = Number(req.query.id)
  if (Number.isNaN(challengeId)) return res.status(400).json({ error: 'Invalid challenge id' })

  try {
    const challenge = await getChallenge(challengeId)
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' })

    const tasks = await listTasks(challengeId)
    const submissions = await getSubmissionsForUser(userId, tasks.map((t) => t.id))

    res.status(200).json({
      tasks: tasks.map((t) => ({
        id: t.id,
        challengeId: t.challenge_id,
        day: t.day,
        title: t.title,
        description: t.description,
        xpReward: t.xp_reward,
        submission: submissions.has(t.id)
          ? {
              status: submissions.get(t.id)!.status,
              submittedAt: submissions.get(t.id)!.submitted_at,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error('challenges/[id]/tasks error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
