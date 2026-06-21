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
  telegramInviteUrl?: string | null
  avatarUrl?: string | null
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
  metric?: 'joins' | 'purchases' | 'revenue'
  threshold?: number
  current?: number
  claimable?: boolean
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

export type RewardTriggerType =
  | 'member_joined'
  | 'referral_joined'
  | 'referral_activated'
  | 'purchase_completed'
  | 'event_registered'
  | 'manual'

export interface RewardRuleDto {
  id: number
  title: string
  trigger: string
  triggerType: RewardTriggerType
  triggerCount: number
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

export interface JoinRequestDto {
  id: number
  telegramUserId: string
  username: string | null
  status: 'pending' | 'approved' | 'declined'
  referralCode: string | null
  createdAt: string
}

export interface AiManagerDto {
  healthScore: number
  weeklyReportStatus: 'ready' | 'scheduled' | 'not_configured'
  faqCount: number
  suggestions: HealthSignalDto[]
  settings: {
    faqEnabled: boolean
    welcomeEnabled: boolean
    reportsEnabled: boolean
    tone: string
  }
}

export interface EventDto {
  id: number
  title: string
  type: 'webinar' | 'meetup' | 'challenge' | 'ama'
  description?: string | null
  startsAt: string
  registrations: number
  priceStars: number
  coverUrl?: string | null
  accessLink?: string | null
  registered?: boolean
}

export interface ProductDto {
  id: number
  title: string
  type: 'course' | 'download' | 'premium_content' | 'consultation'
  description?: string | null
  buttonText?: string | null
  status: 'draft' | 'active'
  purchases: number
  priceStars: number
  coverUrl?: string | null
  deliveryType?: 'file' | 'url' | 'text' | 'none'
  deliveryText?: string | null
  deliveryUrl?: string | null
  fileName?: string | null
  owned?: boolean
}

export interface SubscriptionDto {
  id: number
  planId: number | null
  planName: string | null
  status: string
  interval: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  paymentProvider: string
  paymentReference: string | null
}

export interface PurchaseDto {
  id: number
  kind: 'membership' | 'product' | 'event' | 'stars'
  title: string
  amountStars: number
  amountCents: number
  status: string
  paidAt: string | null
  createdAt: string
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
  joinRequests: JoinRequestDto[]
  ai: AiManagerDto
  events: EventDto[]
  products: ProductDto[]
}

export interface MemberProfileDto {
  community: CommunitySummaryDto
  member: MemberRowDto
  referralLink: string | null
  referralCampaigns: ReferralCampaignDto[]
  plans: PlanDto[]
  subscriptions: SubscriptionDto[]
  rewards: RewardDto[]
  events: EventDto[]
  products: ProductDto[]
  purchases: PurchaseDto[]
  activity: ActivityDto[]
  chats: TelegramChatDto[]
}

export interface MeDto {
  id: number
  username: string | null
  isFirstCommunityOSLogin: boolean
  onboardedAt: string | null
  lastRevenueModel: string | null
  accountStats: {
    communities: number
    memberCommunities: number
    totalMembers: number
    activeSubscriptions: number
    monthlyStars: number
    balanceStars: number
    accessIssues: number
  }
  communities: CommunitySummaryDto[]
  memberCommunities: CommunitySummaryDto[]
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

export interface AiProviderConfigDto {
  id: number
  provider: 'anthropic' | 'openai' | 'gemini' | 'custom'
  label: string
  model: string
  baseUrl: string | null
  apiKeyEnvVar: string
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface InvoiceDto {
  title: string
  description: string
  payload: string
  currency: string
  prices: Array<{ label: string; amount: number }>
  invoiceLink?: string | null
}

export interface UploadAssetDto {
  path: string
  url: string | null
  fileName: string
  mimeType: string
  size: number
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
    joinRequests: [],
    ai: {
      healthScore: 0,
      weeklyReportStatus: 'not_configured',
      faqCount: 0,
      suggestions: [],
      settings: {
        faqEnabled: true,
        welcomeEnabled: true,
        reportsEnabled: true,
        tone: 'friendly',
      },
    },
    events: [],
    products: [],
  }
}

export const api = {
  getMe: () => request<MeDto>('/api/me'),
  completeOnboarding: (body: { revenueModel?: string | null } = {}) =>
    request<{ ok: boolean }>('/api/me/onboarding', { method: 'POST', body: JSON.stringify(body) }),
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
  suspendAccess: (communityId: number | string, userId: number) =>
    request<{ ok: boolean }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'suspend', userId }),
    }),
  restoreAccess: (communityId: number | string, userId: number) =>
    request<{ ok: boolean; inviteLink?: string | null }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'restore', userId }),
    }),
  decideJoinRequest: (communityId: number | string, joinRequestId: number, decision: 'approve_join' | 'decline_join') =>
    request<{ ok: boolean }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: decision, joinRequestId }),
    }),
  syncAccess: (communityId: number | string) =>
    request<{ ok: boolean; scanned?: number; synced?: number; demo?: boolean }>(`/api/communities/${communityId}/access`, {
      method: 'POST',
      body: JSON.stringify({ action: 'sync' }),
    }),
  createInvoice: (
    communityId: number | string,
    body: { title: string; description?: string; stars: number; kind?: 'plan' | 'product' | 'event'; planId?: number | null; productId?: number | null; eventId?: number | null; interval?: string }
  ) =>
    request<{ invoice: InvoiceDto }>(`/api/communities/${communityId}/payments/invoices`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createReferralCampaign: (
    communityId: number | string,
    body: { title: string; reward?: string; status?: 'draft' | 'active' | 'paused'; threshold?: number; metric?: 'joins' | 'purchases' | 'revenue' }
  ) =>
    request<{ campaign: ReferralCampaignDto }>(`/api/communities/${communityId}/referral-campaigns`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createRewardRule: (
    communityId: number | string,
    body: { title: string; triggerType: RewardTriggerType; triggerCount?: number; xpReward?: number; status?: 'draft' | 'active' }
  ) =>
    request<{ rule: RewardRuleDto }>(`/api/communities/${communityId}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_rule', ...body }),
    }),
  generateAiReport: (communityId: number | string) =>
    request<{ ok: boolean; report: { status: 'ready'; summary: string } }>(`/api/communities/${communityId}/ai`, {
      method: 'POST',
      body: JSON.stringify({ action: 'report' }),
    }),
  askAi: (communityId: number | string, question: string) =>
    request<{ answer: string }>(`/api/communities/${communityId}/ai`, {
      method: 'POST',
      body: JSON.stringify({ action: 'ask', question }),
    }),
  updateAiSettings: (
    communityId: number | string,
    body: Partial<{ faqEnabled: boolean; welcomeEnabled: boolean; reportsEnabled: boolean; tone: string }>
  ) =>
    request<{ ok: boolean; settings: AiManagerDto['settings'] }>(`/api/communities/${communityId}/ai`, {
      method: 'POST',
      body: JSON.stringify({ action: 'update_settings', ...body }),
    }),
  uploadAsset: (
    communityId: number | string,
    body: { fileName: string; mimeType: string; dataUrl: string; assetType: 'cover' | 'delivery' }
  ) => request<{ asset: UploadAssetDto }>(`/api/communities/${communityId}/assets`, { method: 'POST', body: JSON.stringify(body) }),
  createEvent: (
    communityId: number | string,
    body: { title: string; type?: EventDto['type']; startsAt?: string; priceStars?: number; description?: string; coverPath?: string | null; accessLink?: string }
  ) =>
    request<{ event: EventDto }>(`/api/communities/${communityId}/events`, { method: 'POST', body: JSON.stringify(body) }),
  deleteEvent: (communityId: number | string, eventId: number) =>
    request<{ ok: boolean; event: EventDto }>(`/api/communities/${communityId}/events?eventId=${eventId}`, { method: 'DELETE' }),
  registerEvent: (communityId: number | string, eventId: number) =>
    request<{ ok: boolean; event: EventDto }>(`/api/communities/${communityId}/events`, {
      method: 'POST',
      body: JSON.stringify({ action: 'register', eventId }),
    }),
  cancelSubscription: (communityId: number | string, subscriptionId: number) =>
    request<{ ok: boolean; subscription: SubscriptionDto }>(`/api/member/${communityId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel', subscriptionId }),
    }),
  shareEventCard: (communityId: number | string, body: { eventId: number; buttonText?: string }) =>
    request<{ ok: boolean; target: 'community_chat' | 'owner_chat'; url: string }>(`/api/communities/${communityId}/events/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createProduct: (
    communityId: number | string,
    body: {
      title: string
      type?: ProductDto['type']
      priceStars?: number
      description?: string
      buttonText?: string
      coverPath?: string | null
      deliveryType?: ProductDto['deliveryType']
      deliveryText?: string
      deliveryUrl?: string
      filePath?: string | null
      fileName?: string | null
    }
  ) =>
    request<{ product: ProductDto }>(`/api/communities/${communityId}/products`, { method: 'POST', body: JSON.stringify(body) }),
  deleteProduct: (communityId: number | string, productId: number) =>
    request<{ ok: boolean; product: ProductDto }>(`/api/communities/${communityId}/products?productId=${productId}`, { method: 'DELETE' }),
  shareProductCard: (communityId: number | string, body: { productId: number; buttonText?: string }) =>
    request<{ ok: boolean; target: 'community_chat' | 'owner_chat'; url: string }>(`/api/communities/${communityId}/products/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  unlockFreeProduct: (communityId: number | string, productId: number) =>
    request<{ ok: boolean; product: ProductDto }>(`/api/member/${communityId}/products`, {
      method: 'POST',
      body: JSON.stringify({ action: 'unlock_free', productId }),
    }),
  getMemberProfile: (communityId: number | string) => request<MemberProfileDto>(`/api/member/${communityId}`),
  claimReward: (communityId: number | string, rewardId: number) =>
    request<{ ok: boolean }>(`/api/communities/${communityId}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ action: 'claim', rewardId }),
    }),
  updateCommunityProfile: (
    communityId: number | string,
    body: { name?: string; handle?: string | null; description?: string | null; telegramInviteUrl?: string | null }
  ) =>
    request<{ community: CommunitySummaryDto }>(`/api/communities/${communityId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  admin: {
    getDashboard: async () => (await request<{ dashboard: AdminDashboardDto }>('/api/admin/dashboard')).dashboard,
    listAiProviders: async () => (await request<{ providers: AiProviderConfigDto[] }>('/api/admin/ai-providers')).providers,
    createAiProvider: (body: {
      provider: AiProviderConfigDto['provider']
      label: string
      model: string
      baseUrl?: string | null
      apiKeyEnvVar: string
      enabled?: boolean
      priority?: number
    }) =>
      request<{ provider: AiProviderConfigDto }>('/api/admin/ai-providers', { method: 'POST', body: JSON.stringify(body) }),
    updateAiProvider: (
      id: number,
      body: Partial<{ label: string; model: string; baseUrl: string | null; apiKeyEnvVar: string; enabled: boolean; priority: number }>
    ) =>
      request<{ provider: AiProviderConfigDto }>('/api/admin/ai-providers', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...body }),
      }),
    deleteAiProvider: (id: number) =>
      request<{ ok: boolean }>(`/api/admin/ai-providers?id=${id}`, { method: 'DELETE' }),
  },
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}
