import { getInitData } from './telegram-webapp'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

export interface CommunitySummaryDto {
  id: number
  name: string
  handle: string | null
  description: string | null
  status: string
}

export interface SetupStepDto {
  id: string
  title: string
  detail: string
  status: 'done' | 'active' | 'locked'
}

export interface HealthSignalDto {
  id: number
  title: string
  detail: string
  tone: 'ok' | 'warn' | 'danger' | 'info'
}

export interface NextActionDto {
  id: string
  title: string
  detail: string
  target: 'access' | 'growth' | 'rewards' | 'more' | 'members'
  priority: 'high' | 'medium' | 'low'
}

export interface MemberRowDto {
  id: number
  username: string
  role: string
  accessStatus: string
  source: string
  xp: number
  level: number
  subscriptionStatus: string
  planName: string | null
  joinedAt: string
  lastActiveAt: string | null
  revenueCents: number
  referralCount: number
}

export interface TelegramChatDto {
  id: number
  title: string
  handle: string | null
  type: 'group' | 'channel'
  botStatus: 'admin' | 'missing_permissions' | 'not_connected'
  accessMode: 'invite_link' | 'join_request'
  activeMembers: number
}

export interface PlanDto {
  id: number
  name: string
  description: string | null
  priceCents: number
  stars: number
  currency: string
  interval: string
  status: string
  subscribers: number
}

export interface ReferralDto {
  id: number
  referrer: string
  referralCode: string
  status: string
  clicks: number
  invites: number
  joins: number
  purchases: number
  revenueCents: number
}

export interface ReferralCampaignDto {
  id: number
  title: string
  reward: string
  status: 'draft' | 'active' | 'paused'
  clicks: number
  joins: number
  purchases: number
  revenueCents: number
}

export interface RewardDto {
  id: number
  type: string
  title: string
  description: string | null
  claimed: boolean
}

export interface RewardRuleDto {
  id: number
  title: string
  trigger: string
  reward: string
  status: 'active' | 'draft'
}

export interface ActivityDto {
  id: number
  title: string
  eventType: string
  createdAt: string
}

export interface AccessLogDto {
  id: number
  action: string
  status: string
  message: string | null
  createdAt: string
}

export interface AiManagerDto {
  healthScore: number
  weeklyReportStatus: 'ready' | 'scheduled' | 'not_configured'
  faqCount: number
  suggestions: HealthSignalDto[]
}

export interface EventDto {
  id: number
  title: string
  type: 'webinar' | 'meetup' | 'challenge' | 'ama'
  startsAt: string
  registrations: number
  priceStars: number
}

export interface ProductDto {
  id: number
  title: string
  type: 'course' | 'download' | 'premium_content' | 'consultation'
  status: 'draft' | 'active'
  purchases: number
  priceStars: number
}

export interface DashboardDto {
  community: CommunitySummaryDto
  setup: SetupStepDto[]
  metrics: {
    healthScore: number
    members: number
    activeSubscriptions: number
    pendingRenewals: number
    referralActivations: number
    monthlyRevenueCents: number
    monthlyStars: number
    xpIssued: number
    accessIssues: number
    productsSold: number
  }
  healthSignals: HealthSignalDto[]
  nextActions: NextActionDto[]
  members: MemberRowDto[]
  chats: TelegramChatDto[]
  plans: PlanDto[]
  referrals: ReferralDto[]
  referralCampaigns: ReferralCampaignDto[]
  rewards: RewardDto[]
  rewardRules: RewardRuleDto[]
  activity: ActivityDto[]
  accessLogs: AccessLogDto[]
  ai: AiManagerDto
  events: EventDto[]
  products: ProductDto[]
}

export interface MemberProfileDto {
  community: CommunitySummaryDto
  member: MemberRowDto
  referralLink: string | null
  rewards: RewardDto[]
  events: EventDto[]
  products: ProductDto[]
  activity: ActivityDto[]
}

export interface MeDto {
  id: number
  username: string | null
  communities: CommunitySummaryDto[]
}

export interface AdminDashboardDto {
  metrics: {
    communities: number
    publishers: number
    monthlyStars: number
    paymentsCents: number
    accessFailures: number
    aiRequests: number
  }
  communities: Array<CommunitySummaryDto & { owner: string; members: number; revenueCents: number; healthScore: number }>
  payments: Array<{ id: number; community: string; buyer: string; stars: number; status: string; createdAt: string }>
  issues: Array<{ id: number; title: string; community: string; severity: 'high' | 'medium' | 'low'; status: string }>
}

export const api = {
  getMe: () => request<MeDto>('/api/me'),
  listCommunities: () => request<{ communities: CommunitySummaryDto[] }>('/api/communities'),
  createCommunity: (body: { name: string; handle?: string; description?: string }) =>
    request<{ community: CommunitySummaryDto }>('/api/communities', { method: 'POST', body: JSON.stringify(body) }),
  getDashboard: (communityId: number | string) => request<DashboardDto>(`/api/communities/${communityId}/dashboard`),
  createPlan: (
    communityId: number | string,
    body: { name: string; description?: string; priceCents?: number; stars?: number; interval?: string }
  ) => request<{ plan: PlanDto }>(`/api/communities/${communityId}/plans`, { method: 'POST', body: JSON.stringify(body) }),
  addMember: (communityId: number | string, body: { userId: number; source?: string }) =>
    request<{ member: unknown }>(`/api/communities/${communityId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  getMemberProfile: (communityId: number | string) => request<MemberProfileDto>(`/api/member/${communityId}`),
  claimReward: (communityId: number | string, rewardId: number) =>
    request<{ ok: boolean }>(`/api/communities/${communityId}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ action: 'claim', rewardId }),
    }),
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}
