import { NextApiRequest, NextApiResponse } from 'next'
import { listChats, syncCommunityAvatar } from '@/lib/access-control'
import { requireUser } from '@/lib/api-auth'
import { signedAssetUrl } from '@/lib/assets'
import { getCommunity, getMemberProfile, listMembers } from '@/lib/communities'
import { listEvents } from '@/lib/events'
import { getReferralCampaignProgress } from '@/lib/growth'
import { listMemberSubscriptions, listPlans } from '@/lib/memberships'
import { listMemberPurchases, listProducts } from '@/lib/payments'
import { referralLink } from '@/lib/referrals'
import { listRewards } from '@/lib/rewards'
import { centsToStars } from '@/lib/star-rate'
import { supabase } from '@/lib/supabase'

async function optional<T>(label: string, fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    console.warn(`member/[communityId] optional ${label} failed:`, error)
    return fallback
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.communityId)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    let avatarPath = community.avatar_path
    if (!avatarPath && community.telegram_chat_id) {
      await syncCommunityAvatar(communityId, community.telegram_chat_id).catch((error) =>
        console.error('member/[communityId] syncCommunityAvatar failed:', error)
      )
      const { data: refreshed } = await supabase
        .from('communities')
        .select('avatar_path')
        .eq('id', communityId)
        .maybeSingle()
      avatarPath = refreshed?.avatar_path ?? null
    }

    await getMemberProfile(communityId, userId)
    const [members, plans, subscriptions, rewards, events, products, purchases, referralProgress, activityRows, chats, avatarUrl] = await Promise.all([
      optional('members', [], () => listMembers(communityId)),
      optional('plans', [], () => listPlans(communityId)),
      optional('subscriptions', [], () => listMemberSubscriptions(communityId, userId)),
      optional('rewards', [], () => listRewards(communityId, userId)),
      optional('events', [], () => listEvents(communityId, userId)),
      optional('products', [], () => listProducts(communityId, userId)),
      optional('purchases', [], () => listMemberPurchases(communityId, userId)),
      optional('referralProgress', [], () => getReferralCampaignProgress(communityId, userId)),
      optional('activity', { data: [], error: null, count: null, status: 200, statusText: 'OK', success: true } as any, async () => {
        return await supabase
          .from('community_activity_events')
          .select('*')
          .eq('community_id', communityId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
      }),
      optional('chats', [], () => listChats(communityId)),
      optional('avatarUrl', null, () => signedAssetUrl(avatarPath, 86400)),
    ])
    const member =
      members.find((row) => row.id === userId) ?? {
        id: userId,
        username: `member_${userId}`,
        role: 'member',
        accessStatus: 'pending',
        source: 'direct',
        xp: 0,
        level: 1,
        subscriptionStatus: 'none',
        planName: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        revenueCents: 0,
        referralCount: 0,
      }

    res.status(200).json({
      community: {
        id: community.id,
        name: community.name,
        handle: community.handle,
        description: community.description,
        status: community.status,
        avatarUrl,
      },
      chats,
      member,
      referralLink: referralLink(communityId, userId),
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceCents: plan.price_cents,
        stars: centsToStars(plan.price_cents),
        currency: plan.currency,
        interval: plan.interval,
        status: plan.status,
        subscribers: plan.subscribers,
        coverUrl: plan.coverUrl ?? null,
        buttonText: plan.buttonText ?? null,
      })),
      subscriptions,
      referralCampaigns: referralProgress.map((item) => ({
        ...item.campaign,
        metric: item.metric,
        threshold: item.threshold,
        current: item.current,
        claimable: item.claimable,
      })),
      rewards: rewards.map((reward) => ({
        id: reward.id,
        type: reward.type,
        title: reward.title,
        description: reward.description,
        claimed: reward.claimed,
      })),
      events,
      products,
      purchases,
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
