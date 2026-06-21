import { listChats, listAccessLogs, listJoinRequests } from './access-control'
import { getAiManager } from './ai'
import { getCommunityMetrics, listActivity } from './analytics'
import { signedAssetUrl } from './assets'
import { getCommunity, listMembers } from './communities'
import { listEvents } from './events'
import { createReferralCampaign, listReferralCampaigns } from './growth'
import { buildHealthSignals, buildNextActions } from './health'
import { listPlans } from './memberships'
import { listProducts } from './payments'
import { listReferrals } from './referrals'
import { listRewardRules, listRewards } from './rewards'
import { computeSetup } from './setup'
import { centsToStars } from './star-rate'
import type { DashboardDto } from './api-client'
import type { CommunityMetrics } from './analytics'

export function planStarsFromCents(priceCents: number): number {
  return centsToStars(priceCents)
}

const emptyMetrics: CommunityMetrics = {
  healthScore: 0,
  members: 0,
  activeSubscriptions: 0,
  pendingRenewals: 0,
  referralActivations: 0,
  monthlyRevenueCents: 0,
  monthlyStars: 0,
  xpIssued: 0,
  accessIssues: 0,
  productsSold: 0,
}

async function optionalSection<T>(label: string, fallback: T, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    console.error(`buildDashboard optional section failed: ${label}`, error)
    return fallback
  }
}

// Aggregates every dashboard section from real tables into the full DashboardDto
// the publisher UI expects. Returns null if the community does not exist.
export async function buildDashboard(communityId: number): Promise<DashboardDto | null> {
  const community = await getCommunity(communityId)
  if (!community) return null

  const [metrics, members, chats, plans, referrals, referralCampaigns, rewards, rewardRules, activity, accessLogs, joinRequests, ai, events, products, setup, avatarUrl] =
    await Promise.all([
      optionalSection('metrics', emptyMetrics, () => getCommunityMetrics(communityId)),
      optionalSection('members', [], () => listMembers(communityId)),
      optionalSection('chats', [], () => listChats(communityId)),
      optionalSection('plans', [], () => listPlans(communityId)),
      optionalSection('referrals', [], () => listReferrals(communityId)),
      optionalSection('referralCampaigns', [], () => listReferralCampaigns(communityId)),
      optionalSection('rewards', [], () => listRewards(communityId)),
      optionalSection('rewardRules', [], () => listRewardRules(communityId)),
      optionalSection('activity', [], () => listActivity(communityId)),
      optionalSection('accessLogs', [], () => listAccessLogs(communityId)),
      optionalSection('joinRequests', [], () => listJoinRequests(communityId)),
      optionalSection(
        'ai',
        {
          healthScore: 0,
          weeklyReportStatus: 'not_configured' as const,
          faqCount: 0,
          suggestions: [],
          settings: { faqEnabled: true, welcomeEnabled: true, reportsEnabled: true, tone: 'friendly' },
        },
        () => getAiManager(communityId)
      ),
      optionalSection('events', [], () => listEvents(communityId)),
      optionalSection('products', [], () => listProducts(communityId)),
      optionalSection('setup', [], () => computeSetup(communityId)),
      optionalSection('avatarUrl', null, () => signedAssetUrl(community.avatar_path, 86400)),
    ])

  return {
    community: {
      id: community.id,
      name: community.name,
      handle: community.handle,
      description: community.description,
      status: community.status,
      avatarUrl,
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
    joinRequests,
    ai,
    events,
    products,
  }
}

export { createReferralCampaign }
