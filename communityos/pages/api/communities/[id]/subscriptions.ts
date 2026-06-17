import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { createOrUpdateSubscription } from '@/lib/memberships'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ownerId = await requireUser(req, res)
  if (ownerId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(ownerId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const { userId, planId, status } = req.body ?? {}
    if (typeof userId !== 'number') return res.status(400).json({ error: 'userId is required' })

    const subscription = await createOrUpdateSubscription(
      communityId,
      userId,
      typeof planId === 'number' ? planId : null,
      status === 'trialing' || status === 'active' || status === 'past_due' || status === 'expired' || status === 'cancelled'
        ? status
        : 'active'
    )
    res.status(201).json({ subscription })
  } catch (error) {
    console.error('communities/[id]/subscriptions error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
