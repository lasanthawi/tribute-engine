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

export interface NewsHeadlineDto {
  id: string
  title: string
  url: string
  source: string
  sentiment: 'positive' | 'negative' | 'neutral'
  publishedAt: string
}

export interface SentimentDto {
  fearGreed: { score: number; label: string; updatedAt: string } | null
  headlines: NewsHeadlineDto[]
}

export interface QuestDto {
  id: number
  code: string
  title: string
  description: string
  type: 'daily' | 'weekly'
  progress: number
  target: number
  rewardType: 'points' | 'coins' | 'tickets' | 'perk'
  rewardAmount: number
  rewardPerkType: 'confidence_boost' | 'streak_freeze' | null
  rewardType2: 'points' | 'coins' | 'tickets' | 'perk' | null
  rewardAmount2: number | null
  rewardPerkType2: 'confidence_boost' | 'streak_freeze' | null
  completed: boolean
  claimed: boolean
}

export interface AchievementDto {
  code: string
  title: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
  progress: number | null
  target: number | null
}

export type GameId = 'tap' | 'spin' | 'gomoku'

export interface GameDto {
  id: GameId
  title: string
  description: string
  icon: string
  remainingPlays: number
  maxPlaysPerDay: number
}

export interface TapPlayResultDto {
  rewardPoints: number
  remainingPlays: number
}

export interface SpinResultDto {
  segmentIndex: number
  rewardPoints: number
  rewardTickets: number
  rewardCoins: number
  remainingPlays: number
}

export type GomokuMarkDto = 'X' | 'O'
export type GomokuStatusDto = 'waiting' | 'active' | 'settled' | 'cancelled'

export interface GomokuMatchDto {
  id: number
  shareCode: string
  status: GomokuStatusDto
  board: Array<Array<GomokuMarkDto | null>>
  currentTurn: GomokuMarkDto
  myMark: GomokuMarkDto | null
  winnerMark: GomokuMarkDto | 'draw' | null
  winningCells: Array<[number, number]>
  moveCount: number
  players: {
    X: { id: number; label: string } | null
    O: { id: number; label: string } | null
  }
}

export interface ProfileDto {
  username: string | null
  totalVotes: number
  totalCorrect: number
  accuracy: number
  bestStreak: number
  currentStreak: number
  points: number
  league: {
    current: { name: string; icon: string; color: string }
    next: { name: string; icon: string; color: string; minPoints: number } | null
    progress: number
    remaining: number
  }
  achievements: AchievementDto[]
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
  getSentiment: () => request<SentimentDto>('/api/sentiment'),
  getQuests: () => request<{ quests: QuestDto[] }>('/api/quests'),
  claimQuest: (questId: number) =>
    request<{ ok: true }>('/api/quests/claim', {
      method: 'POST',
      body: JSON.stringify({ questId }),
    }),
  getProfile: () => request<ProfileDto>('/api/profile'),
  getGames: () => request<{ games: GameDto[] }>('/api/games'),
  playTapGame: (score: number) =>
    request<TapPlayResultDto>('/api/games/tap/play', {
      method: 'POST',
      body: JSON.stringify({ score }),
    }),
  spinWheel: () => request<SpinResultDto>('/api/games/spin', { method: 'POST' }),
  createGomokuMatch: () =>
    request<{ match: GomokuMatchDto }>('/api/games/gomoku/create', { method: 'POST' }),
  joinGomokuMatch: (shareCode: string) =>
    request<{ match: GomokuMatchDto }>('/api/games/gomoku/join', {
      method: 'POST',
      body: JSON.stringify({ shareCode }),
    }),
  getGomokuMatch: (matchId: number) =>
    request<{ match: GomokuMatchDto }>(`/api/games/gomoku/match?id=${matchId}`),
  playGomokuMove: (matchId: number, row: number, col: number) =>
    request<{ match: GomokuMatchDto }>('/api/games/gomoku/move', {
      method: 'POST',
      body: JSON.stringify({ matchId, row, col }),
    }),
}
