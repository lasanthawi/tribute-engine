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
    const err = Object.assign(new Error(body.error || `Request failed: ${res.status}`), { status: res.status })
    throw err
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

export interface InvoiceDto {
  title: string
  description: string
  payload: string
  currency: string
  prices: Array<{ label: string; amount: number }>
  invoiceLink?: string | null
}

export function emptyDashboardForCommunity(community: CommunitySummaryDto): DashboardDto {
  return {
    community,
    setup: [],
    metrics: {
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
    },
    healthSignals: [],
    nextActions: [],
    members: [],
    chats: [],
    plans: [],
    referrals: [],
    referralCampaigns: [],
    rewards: [],
    rewardRules: [],
    activity: [],
    accessLogs: [],
    ai: {
      healthScore: 0,
      weeklyReportStatus: 'not_configured',
      faqCount: 0,
      suggestions: [],
    },
    events: [],
    products: [],
  }
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
  deletePlan: (communityId: number | string, planId: number) =>
    request<{ ok: boolean; plan: PlanDto }>(`/api/communities/${communityId}/plans?planId=${planId}`, { method: 'DELETE' }),
  sharePlanCard: (communityId: number | string, body: { planId: number; buttonText?: string }) =>
    request<{ ok: boolean; target: 'community_chat' | 'owner_chat'; url: string }>(`/api/communities/${communityId}/plans/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addMember: (communityId: number | string, body: { userId: number; source?: string }) =>
    request<{ member: unknown }>(`/api/communities/${communityId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  grantAccess: (communityId: number | string, userId: number) =>
    request<{ ok: boolean; inviteLink?: string | null }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'grant', userId }),
    }),
  revokeAccess: (communityId: number | string, userId: number) =>
    request<{ ok: boolean }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'revoke', userId }),
    }),
  syncAccess: (communityId: number | string) =>
    request<{ ok: boolean; scanned?: number; synced?: number; demo?: boolean }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'sync' }),
    }),
  createInvoice: (
    communityId: number | string,
    body: { title: string; description?: string; stars: number; productId?: number | null }
  ) =>
    request<{ invoice: InvoiceDto }>(`/api/communities/${communityId}/payments/invoices`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createReferralCampaign: (communityId: number | string, body: { title: string; reward?: string; status?: 'draft' | 'active' | 'paused' }) =>
    request<{ campaign: ReferralCampaignDto }>(`/api/communities/${communityId}/referral-campaigns`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createRewardRule: (communityId: number | string, body: { title: string; trigger?: string; reward?: string; status?: 'draft' | 'active' }) =>
    request<{ rule: RewardRuleDto }>(`/api/communities/${communityId}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_rule', ...body }),
    }),
  createEvent: (communityId: number | string, body: { title: string; type?: EventDto['type']; startsAt?: string; priceStars?: number }) =>
    request<{ event: EventDto }>(`/api/communities/${communityId}/events`, { method: 'POST', body: JSON.stringify(body) }),
  createProduct: (communityId: number | string, body: { title: string; type?: ProductDto['type']; priceStars?: number }) =>
    request<{ product: ProductDto }>(`/api/communities/${communityId}/products`, { method: 'POST', body: JSON.stringify(body) }),
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
