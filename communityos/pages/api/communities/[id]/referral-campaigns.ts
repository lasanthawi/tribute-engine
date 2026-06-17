import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { createReferralCampaign, listReferralCampaigns } from '@/lib/growth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') return res.status(200).json({ campaigns: await listReferralCampaigns(communityId) })

    if (req.method === 'POST') {
      const { title, reward, status } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const campaign = await createReferralCampaign(communityId, {
        title,
        reward: typeof reward === 'string' ? reward : undefined,
        status,
      })
      return res.status(201).json({ campaign })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/referral-campaigns error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
