import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { claimReward, createReward, createRewardRule, listRewards } from '@/lib/rewards'

interface RewardRow {
  id: number
  type: string
  title: string
  description: string | null
  claimed?: boolean
}

function toDto(reward: RewardRow) {
  return {
    id: reward.id,
    type: reward.type,
    title: reward.title,
    description: reward.description,
    claimed: !!reward.claimed,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    if (req.method === 'GET') {
      const allowed = await requireCommunityOwner(userId, communityId)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })
      const rewards = await listRewards(communityId)
      return res.status(200).json({ rewards: rewards.map(toDto) })
    }

    if (req.method === 'POST') {
      const { action } = req.body ?? {}
      if (action === 'claim') {
        const { rewardId } = req.body ?? {}
        if (typeof rewardId !== 'number') return res.status(400).json({ error: 'rewardId is required' })
        const result = await claimReward(communityId, userId, rewardId)
        return res.status(result.ok ? 200 : 400).json(result)
      }

      const allowed = await requireCommunityOwner(userId, communityId)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })

      if (action === 'create_rule') {
        const { title, trigger, reward, status } = req.body ?? {}
        if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
        const rule = await createRewardRule(communityId, {
          title,
          trigger: typeof trigger === 'string' ? trigger : 'Manual unlock',
          xpReward: typeof reward === 'string' ? Number(reward.replace(/[^0-9]/g, '')) || 0 : 0,
          status: status === 'draft' ? 'draft' : 'active',
        })
        return res.status(201).json({ rule })
      }

      const { title, description, type, criteria } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const reward = await createReward(communityId, {
        title,
        description: typeof description === 'string' ? description : null,
        type,
        criteria: typeof criteria === 'object' && criteria ? criteria : {},
      })
      return res.status(201).json({ reward: toDto(reward) })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/rewards error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
