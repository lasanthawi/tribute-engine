import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, getMemberProfile, listMembers } from '@/lib/communities'
import { demoMemberProfile } from '@/lib/demo-data'
import { referralLink } from '@/lib/referrals'
import { listRewards } from '@/lib/rewards'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.communityId)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  if (isDemoMode) return res.status(200).json(demoMemberProfile)

  try {
    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    await getMemberProfile(communityId, userId)
    const [members, rewards] = await Promise.all([listMembers(communityId), listRewards(communityId, userId)])
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
      activity: [],
    })
  } catch (error) {
    console.error('member/[communityId] error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
