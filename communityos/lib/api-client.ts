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

export interface PlatformOverviewDto {
  communities: number
  activeCommunities: number
  newCommunities30d: number
  publishers: number
  stars30d: number
  revenueCents30d: number
  revenueCentsAllTime: number
  mrrCents: number
  expiredSubs30d: number
  accessSuccessRate: number
  pendingJoinRequests: number
  accessFailures: number
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
  overview: PlatformOverviewDto
  communities: Array<CommunitySummaryDto & { owner: string; members: number; revenueCents: number; healthScore: number }>
  payments: Array<{ id: number; community: string; buyer: string; stars: number; status: string; createdAt: string }>
  issues: Array<{ id: number; title: string; community: string; severity: 'high' | 'medium' | 'low'; status: string }>
}

export interface AdminCommunityDetailDto {
  community: {
    id: number
    name: string
    handle: string | null
    description: string | null
    status: string
    telegramChatId: number | null
    owner: string
  }
  metrics: {
    healthScore: number
    members: number
    activeSubscriptions: number
    pendingRenewals: number
    monthlyRevenueCents: number
    monthlyStars: number
    accessIssues: number
    productsSold: number
  }
  members: MemberRowDto[]
  logs: Array<{ id: number; action: string; status: string; message: string | null; created_at: string }>
  payments: Array<{ id: number; buyer_user_id: number; amount_stars: number; status: string; created_at: string }>
}

export interface PlatformAdminDto {
  id: number
  userId: number
  role: string
  username: string | null
  telegramId: number | null
  createdAt: string
}

export interface AuditEventDto {
  id: number
  actor: string
  community: string | null
  eventType: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface AdminPaymentDto {
  id: number
  community: string
  buyer: string
  stars: number
  amountCents: number
  status: string
  source: string | null
  createdAt: string
}

export interface AdminSearchDto {
  communities: Array<{ id: number; name: string; handle: string | null; status: string }>
  users: Array<{ id: number; username: string | null; telegramId: number }>
  payments: Array<{ id: number; communityId: number; buyerUserId: number; stars: number; status: string; createdAt: string }>
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
  createRewardRule: (communityId: number | string, body: { title: string; trigger?: string; reward?: string; status?: 'draft' | 'active' }) =>
    request<{ rule: RewardRuleDto }>(`/api/communities/${communityId}/rewards`, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_rule', ...body }),
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

  // --- Platform admin ---
  getAdminDashboard: () => request<AdminDashboardDto>('/api/admin/dashboard'),
  getAdminCommunity: (communityId: number | string) =>
    request<AdminCommunityDetailDto>(`/api/admin/communities/${communityId}`),
  setCommunityStatus: (communityId: number | string, status: 'active' | 'paused' | 'archived') =>
    request<{ ok: boolean }>(`/api/admin/communities/${communityId}`, {
      method: 'POST',
      body: JSON.stringify({ action: status === 'active' ? 'activate' : status === 'paused' ? 'pause' : 'archive' }),
    }),
  adminRevokeAccess: (communityId: number, userId: number) =>
    request<{ ok: boolean }>('/api/admin/members', { method: 'POST', body: JSON.stringify({ action: 'revoke', communityId, userId }) }),
  adminRestoreAccess: (communityId: number, userId: number) =>
    request<{ ok: boolean }>('/api/admin/members', { method: 'POST', body: JSON.stringify({ action: 'restore', communityId, userId }) }),
  adminSyncAccess: (communityId?: number) =>
    request<{ ok: boolean; scanned: number; synced: number }>('/api/admin/members', {
      method: 'POST',
      body: JSON.stringify({ action: 'sync', communityId }),
    }),
  adminResolveIssue: (logId: number) =>
    request<{ ok: boolean }>('/api/admin/issues', { method: 'POST', body: JSON.stringify({ action: 'resolve', logId }) }),
  listAdminPayments: (params: { status?: string; communityId?: number; days?: number } = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.communityId) query.set('communityId', String(params.communityId))
    if (params.days) query.set('days', String(params.days))
    const qs = query.toString()
    return request<{ payments: AdminPaymentDto[] }>(`/api/admin/payments${qs ? `?${qs}` : ''}`)
  },
  listPlatformAdmins: () => request<{ admins: PlatformAdminDto[] }>('/api/admin/admins'),
  addPlatformAdmin: (body: { telegramId?: number; userId?: number; role?: string }) =>
    request<{ ok: boolean; reason?: string }>('/api/admin/admins', { method: 'POST', body: JSON.stringify(body) }),
  removePlatformAdmin: (userId: number) =>
    request<{ ok: boolean; reason?: string }>(`/api/admin/admins?userId=${userId}`, { method: 'DELETE' }),
  listAuditEvents: (params: { communityId?: number; actorId?: number; type?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.communityId) query.set('communityId', String(params.communityId))
    if (params.actorId) query.set('actorId', String(params.actorId))
    if (params.type) query.set('type', params.type)
    const qs = query.toString()
    return request<{ events: AuditEventDto[] }>(`/api/admin/audit${qs ? `?${qs}` : ''}`)
  },
  adminSearch: (q: string) => request<AdminSearchDto>(`/api/admin/search?q=${encodeURIComponent(q)}`),
}

export function money(cents: number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}
