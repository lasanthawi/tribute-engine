import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { createReferralCampaign, listReferralCampaigns, updateReferralCampaign } from '@/lib/growth'

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
      const { title, reward, status, targetType, targetId } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const validTargetType = targetType === 'plan' || targetType === 'product' || targetType === 'event' ? targetType : undefined
      const campaign = await createReferralCampaign(communityId, {
        title,
        reward: typeof reward === 'string' ? reward : undefined,
        status,
        targetType: validTargetType,
        targetId: validTargetType && Number.isFinite(Number(targetId)) ? Number(targetId) : undefined,
      })
      return res.status(201).json({ campaign })
    }

    if (req.method === 'PATCH') {
      const { campaignId, status } = req.body ?? {}
      if (!Number.isFinite(Number(campaignId))) return res.status(400).json({ error: 'campaignId is required' })
      if (status !== 'draft' && status !== 'active' && status !== 'paused') {
        return res.status(400).json({ error: 'Invalid status' })
      }
      const campaign = await updateReferralCampaign(communityId, Number(campaignId), { status })
      return res.status(200).json({ campaign })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/referral-campaigns error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
