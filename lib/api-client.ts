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

export interface RoundDto {
  id: number
  asset: 'BTC' | 'ETH' | 'TON'
  kind: 'hourly' | 'main_daily'
  state: string
  open_at: string
  lock_at: string
  resolve_at: string
  base_reward: number
  myPrediction: { side: 'UP' | 'DOWN'; confidence: number } | null
  sentiment: { up: number; down: number; total: number }
}

export interface MeDto {
  id: number
  telegramId: number
  username: string | null
  points: number
  tickets: number
  coins: number
  streak: number
  streakMultiplier: number
  dailyBonusAwarded: boolean
  dailyBonusAmount: number
  confidenceBoosts: number
  streakFreezes: number
}

export interface CoinPackageDto {
  id: string
  coins: number
  stars: number
  label: string
  bonus?: string
}

export type RedeemOption = 'points' | 'ticket' | 'confidence_boost' | 'streak_freeze'

export interface CallDto {
  id: number
  side: 'UP' | 'DOWN'
  confidence: number
  isCorrect: boolean | null
  pointsEarned: number | null
  createdAt: string
  round: {
    id: number
    asset: 'BTC' | 'ETH' | 'TON'
    kind: 'hourly' | 'main_daily'
    state: string
    strike: number | null
    close: number | null
    outcome: 'UP' | 'DOWN' | 'VOID' | null
    resolve_at: string
  }
}

export interface LeaderboardEntryDto {
  rank: number
  userId: number
  username: string
  points: number
  isMe: boolean
}

export interface LeaderboardDto {
  period: 'weekly' | 'season'
  leaderboard: LeaderboardEntryDto[]
  me: { rank: number | null; userId: number; username: string; points: number; isMe: true }
}

export interface ReferralInfoDto {
  link: string | null
  referralCode: string
  activatedCount: number
  pendingCount: number
  overrideEarned: number
}

export const api = {
  getMe: () => request<MeDto>('/api/me'),
  getOpenRounds: () => request<{ rounds: RoundDto[] }>('/api/rounds/open'),
  getCalls: () => request<{ pending: CallDto[]; settled: CallDto[] }>('/api/me/calls'),
  getLeaderboard: (period: 'weekly' | 'season') =>
    request<LeaderboardDto>(`/api/leaderboard?period=${period}`),
  getReferralInfo: () => request<ReferralInfoDto>('/api/referral/info'),
  predict: (roundId: number, side: 'UP' | 'DOWN', confidence: number) =>
    request<{ ok: true }>('/api/predictions/create', {
      method: 'POST',
      body: JSON.stringify({ roundId, side, confidence }),
    }),
  getCoinPackages: () => request<{ packages: CoinPackageDto[] }>('/api/coins/packages'),
  createCoinInvoice: (packageId: string) =>
    request<{ url: string | null }>('/api/coins/invoice', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    }),
  redeemCoins: (option: RedeemOption, coins?: number) =>
    request<{ ok: true; pointsAwarded?: number }>('/api/coins/redeem', {
      method: 'POST',
      body: JSON.stringify({ option, coins }),
    }),
}
