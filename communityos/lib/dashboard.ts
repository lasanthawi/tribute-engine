import { listChats, listAccessLogs } from './access-control'
import { getAiManager } from './ai'
import { getCommunityMetrics, listActivity } from './analytics'
import { getCommunity, listMembers } from './communities'
import { listEvents } from './events'
import { createReferralCampaign, listReferralCampaigns } from './growth'
import { buildHealthSignals, buildNextActions } from './health'
import { listPlans } from './memberships'
import { listProducts } from './payments'
import { listReferrals } from './referrals'
import { listRewardRules, listRewards } from './rewards'
import { computeSetup } from './setup'
import type { DashboardDto } from './api-client'

export function planStarsFromCents(priceCents: number): number {
  return Math.round(priceCents / 10)
}

// Aggregates every dashboard section from real tables into the full DashboardDto
// the publisher UI expects. Returns null if the community does not exist.
export async function buildDashboard(communityId: number): Promise<DashboardDto | null> {
  const community = await getCommunity(communityId)
  if (!community) return null

  const [metrics, members, chats, plans, referrals, referralCampaigns, rewards, rewardRules, activity, accessLogs, ai, events, products, setup] =
    await Promise.all([
      getCommunityMetrics(communityId),
      listMembers(communityId),
      listChats(communityId),
      listPlans(communityId),
      listReferrals(communityId),
      listReferralCampaigns(communityId),
      listRewards(communityId),
      listRewardRules(communityId),
      listActivity(communityId),
      listAccessLogs(communityId),
      getAiManager(communityId),
      listEvents(communityId),
      listProducts(communityId),
      computeSetup(communityId),
    ])

  return {
    community: {
      id: community.id,
      name: community.name,
      handle: community.handle,
      description: community.description,
      status: community.status,
    },
    setup,
    metrics,
    healthSignals: buildHealthSignals(metrics),
    nextActions: buildNextActions(metrics),
    members,
    chats,
    plans: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      priceCents: plan.price_cents,
      stars: planStarsFromCents(plan.price_cents),
      currency: plan.currency,
      interval: plan.interval,
      status: plan.status,
      subscribers: plan.subscribers,
    })),
    referrals,
    referralCampaigns,
    rewards: rewards.map((reward) => ({
      id: reward.id,
      type: reward.type,
      title: reward.title,
      description: reward.description,
      claimed: reward.claimed,
    })),
    rewardRules,
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
    ai,
    events,
    products,
  }
}

export { createReferralCampaign }
