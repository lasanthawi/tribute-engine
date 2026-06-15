import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { listAccessLogs } from '@/lib/access-control'
import { getCommunityMetrics, listActivity } from '@/lib/analytics'
import { getCommunity, listMembers, requireCommunityOwner } from '@/lib/communities'
import { demoDashboard } from '@/lib/demo-data'
import { listPlans } from '@/lib/memberships'
import { listReferrals } from '@/lib/referrals'
import { listRewards } from '@/lib/rewards'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  if (isDemoMode) return res.status(200).json(demoDashboard)

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    const [metrics, members, plans, referrals, rewards, activity, accessLogs] = await Promise.all([
      getCommunityMetrics(communityId),
      listMembers(communityId),
      listPlans(communityId),
      listReferrals(communityId),
      listRewards(communityId),
      listActivity(communityId),
      listAccessLogs(communityId),
    ])

    res.status(200).json({
      community: {
        id: community.id,
        name: community.name,
        handle: community.handle,
        description: community.description,
        status: community.status,
      },
      metrics,
      members,
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceCents: plan.price_cents,
        currency: plan.currency,
        interval: plan.interval,
        status: plan.status,
        subscribers: plan.subscribers,
      })),
      referrals,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        type: reward.type,
        title: reward.title,
        description: reward.description,
        claimed: reward.claimed,
      })),
      activity: activity.map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.event_type,
        createdAt: event.created_at,
      })),
      accessLogs: accessLogs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        message: log.message,
        createdAt: log.created_at,
      })),
    })
  } catch (error) {
    console.error('communities/[id]/dashboard error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
