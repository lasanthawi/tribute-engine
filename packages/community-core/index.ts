export type AccessStatus = 'pending' | 'granted' | 'failed' | 'revoked' | 'expired'
export type LedgerSource = 'telegram' | 'stars' | 'referral' | 'reward' | 'admin' | 'cron'

export interface TelegramIdentity {
  telegramId: number
  username?: string
  firstName?: string
  lastName?: string
  startParam?: string
}

export interface AccessPolicyInput {
  subscriptionStatus: string
  paymentStatus?: string
  expiresAt?: string | null
  currentAccessStatus: AccessStatus
}

export interface AccessDecision {
  status: AccessStatus
  reason: string
  shouldGrant: boolean
  shouldRevoke: boolean
}

export function decideAccess(input: AccessPolicyInput): AccessDecision {
  const expired = input.expiresAt ? new Date(input.expiresAt).getTime() < Date.now() : false

  if (input.subscriptionStatus === 'active' && !expired) {
    return { status: 'granted', reason: 'Active subscription is eligible for Telegram access.', shouldGrant: true, shouldRevoke: false }
  }

  if (input.subscriptionStatus === 'trialing' && !expired) {
    return { status: 'pending', reason: 'Trial member requires approval or invite link issuance.', shouldGrant: false, shouldRevoke: false }
  }

  if (input.currentAccessStatus === 'granted') {
    return { status: 'expired', reason: 'Subscription is no longer active; access should be revoked.', shouldGrant: false, shouldRevoke: true }
  }

  return { status: 'pending', reason: 'Member is not currently eligible for access.', shouldGrant: false, shouldRevoke: false }
}

export interface ReferralAttributionInput {
  code: string
  clickId?: string
  purchaserUserId?: number
  purchaseCents?: number
}

export function normalizeReferralCode(value: string) {
  return value.trim().replace(/^start=/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
}

export function xpForAction(action: string) {
  const table: Record<string, number> = {
    join_community: 10,
    daily_activity: 20,
    referral_activation: 250,
    purchase: 50,
    event_attended: 100,
  }
  return table[action] ?? 0
}

export interface StarsInvoiceInput {
  title: string
  description: string
  payload: string
  stars: number
}

export function createStarsInvoicePayload(input: StarsInvoiceInput) {
  return {
    title: input.title,
    description: input.description,
    payload: input.payload,
    currency: 'XTR',
    prices: [{ label: input.title, amount: input.stars }],
  }
}

export interface HealthScoreInput {
  accessIssues: number
  activeSubscriptions: number
  members: number
  referralActivations: number
  failedRenewals: number
}

export function calculateHealthScore(input: HealthScoreInput) {
  const accessPenalty = Math.min(25, input.accessIssues * 4)
  const renewalPenalty = Math.min(20, input.failedRenewals * 5)
  const paidRatio = input.members > 0 ? input.activeSubscriptions / input.members : 0
  const paidScore = Math.round(Math.min(25, paidRatio * 25))
  const referralScore = Math.min(20, input.referralActivations)
  return Math.max(0, Math.min(100, 55 + paidScore + referralScore - accessPenalty - renewalPenalty))
}
