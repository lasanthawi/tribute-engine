import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, getMemberProfile, listMembers } from '@/lib/communities'
import { listEvents } from '@/lib/events'
import { listProducts } from '@/lib/payments'
import { referralLink } from '@/lib/referrals'
import { listRewards } from '@/lib/rewards'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.communityId)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    await getMemberProfile(communityId, userId)
    const [members, rewards, events, products, activityRows] = await Promise.all([
      listMembers(communityId),
      listRewards(communityId, userId),
      listEvents(communityId),
      listProducts(communityId),
      supabase
        .from('community_activity_events')
        .select('*')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    const member = members.find((row) => row.id === userId)
    if (!member) return res.status(404).json({ error: 'Member not found' })

    res.status(200).json({
      community: {
        id: community.id,
        name: community.name,
        handle: community.handle,
        description: community.description,
        status: community.status,
      },
      member,
      referralLink: referralLink(communityId, userId),
      rewards: rewards.map((reward) => ({
        id: reward.id,
        type: reward.type,
        title: reward.title,
        description: reward.description,
        claimed: reward.claimed,
      })),
      events,
      products,
      activity: ((activityRows.data ?? []) as Array<{ id: number; title: string; event_type: string; created_at: string }>).map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.event_type,
        createdAt: event.created_at,
      })),
    })
  } catch (error) {
    console.error('member/[communityId] error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
