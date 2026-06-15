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

export interface MeDto {
  id: number
  telegramId: number
  username: string | null
  xp: number
  level: number
  activeChallenges: { id: number; title: string; status: string; category: string }[]
}

export interface ChallengeDto {
  id: number
  title: string
  description: string
  coverUrl: string | null
  category: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  rules: string | null
  rewards: Record<string, unknown> | null
  memberCount?: number
  isMember?: boolean
  membershipStatus?: 'active' | 'completed' | 'dropped' | null
}

export interface TaskDto {
  id: number
  challengeId: number
  day: number
  title: string
  description: string | null
  xpReward: number
  submission: { status: string; submittedAt: string } | null
}

export interface LeaderboardEntryDto {
  rank: number
  userId: number
  username: string
  xp: number
  isMe: boolean
}

export interface LeaderboardDto {
  scope: 'challenge' | 'community' | 'global'
  challengeId: number | null
  leaderboard: LeaderboardEntryDto[]
  me: { rank: number | null; userId: number; username: string; xp: number; isMe: true }
}

export interface ReferralInfoDto {
  link: string | null
  referralCode: string
  activatedCount: number
  pendingCount: number
  xpFromInvites: number
}

export interface RewardDto {
  id: number
  challengeId: number | null
  type: string
  title: string
  description: string | null
  criteria: Record<string, unknown> | null
  claimed: boolean
  claimedAt: string | null
}

export const api = {
  getMe: () => request<MeDto>('/api/me'),
  getChallenges: (status?: string) =>
    request<{ challenges: ChallengeDto[] }>(`/api/challenges${status ? `?status=${status}` : ''}`),
  getChallenge: (id: number | string) => request<{ challenge: ChallengeDto }>(`/api/challenges/${id}`),
  joinChallenge: (id: number | string) =>
    request<{ joined: boolean }>(`/api/challenges/${id}/join`, { method: 'POST' }),
  getChallengeTasks: (id: number | string) => request<{ tasks: TaskDto[] }>(`/api/challenges/${id}/tasks`),
  submitTask: (id: number | string, body: { evidenceType: string; evidenceContent?: string }) =>
    request<{ xpAwarded: number }>(`/api/tasks/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getLeaderboard: (scope: 'challenge' | 'community' | 'global', challengeId?: number | string) =>
    request<LeaderboardDto>(
      `/api/leaderboard?scope=${scope}${challengeId ? `&challengeId=${challengeId}` : ''}`
    ),
  getReferralInfo: () => request<ReferralInfoDto>('/api/referral/info'),
  getRewards: (challengeId?: number | string) =>
    request<{ rewards: RewardDto[] }>(`/api/rewards${challengeId ? `?challengeId=${challengeId}` : ''}`),
  claimReward: (rewardId: number) =>
    request<{ ok: boolean; alreadyClaimed: boolean; xpAwarded: number }>('/api/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    }),
}
