import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { demoQuests } from '@/lib/demo-data'
import { getActiveQuestsForUser } from '@/lib/quests'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoQuests())

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const quests = await getActiveQuestsForUser(userId)
    res.status(200).json({
      quests: quests.map((q) => ({
        id: q.definition.id,
        code: q.definition.code,
        title: q.definition.title,
        description: q.definition.description,
        type: q.definition.type,
        progress: q.progress,
        target: q.target,
        rewardType: q.definition.reward_type,
        rewardAmount: q.definition.reward_amount,
        rewardPerkType: q.definition.reward_perk_type,
        rewardType2: q.definition.reward_type_2,
        rewardAmount2: q.definition.reward_amount_2,
        rewardPerkType2: q.definition.reward_perk_type_2,
        completed: q.completedAt !== null,
        claimed: q.claimedAt !== null,
      })),
    })
  } catch (error) {
    console.error('quests/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
