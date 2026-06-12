import type { CallDto, LeaderboardDto, MeDto, ReferralInfoDto, RoundDto } from './api-client'

const MIN = 60_000
const HOUR = 60 * MIN

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

export function demoMe(): MeDto {
  return {
    id: 1,
    telegramId: 100001,
    username: 'satoshi_fan',
    points: 2480,
    tickets: 3,
    streak: 4,
    streakMultiplier: 1.4,
    dailyBonusAwarded: false,
    dailyBonusAmount: 50,
  }
}

export function demoRounds(): RoundDto[] {
  return [
    {
      id: 1,
      asset: 'BTC',
      kind: 'main_daily',
      state: 'OPEN',
      open_at: iso(-2 * HOUR),
      lock_at: iso(6 * HOUR),
      resolve_at: iso(7 * HOUR),
      base_reward: 200,
      myPrediction: null,
    },
    {
      id: 2,
      asset: 'BTC',
      kind: 'hourly',
      state: 'OPEN',
      open_at: iso(-10 * MIN),
      lock_at: iso(4 * MIN),
      resolve_at: iso(34 * MIN),
      base_reward: 100,
      myPrediction: { side: 'UP', confidence: 150 },
    },
    {
      id: 3,
      asset: 'ETH',
      kind: 'hourly',
      state: 'OPEN',
      open_at: iso(-5 * MIN),
      lock_at: iso(25 * MIN),
      resolve_at: iso(55 * MIN),
      base_reward: 100,
      myPrediction: null,
    },
    {
      id: 4,
      asset: 'TON',
      kind: 'hourly',
      state: 'OPEN',
      open_at: iso(-20 * MIN),
      lock_at: iso(40 * MIN),
      resolve_at: iso(70 * MIN),
      base_reward: 100,
      myPrediction: null,
    },
  ]
}

export function demoCalls(): { pending: CallDto[]; settled: CallDto[] } {
  const pending: CallDto[] = [
    {
      id: 101,
      side: 'UP',
      confidence: 150,
      isCorrect: null,
      pointsEarned: null,
      createdAt: iso(-15 * MIN),
      round: {
        id: 2,
        asset: 'BTC',
        kind: 'hourly',
        state: 'OPEN',
        strike: null,
        close: null,
        outcome: null,
        resolve_at: iso(34 * MIN),
      },
    },
  ]

  const settled: CallDto[] = [
    {
      id: 100,
      side: 'UP',
      confidence: 200,
      isCorrect: true,
      pointsEarned: 280,
      createdAt: iso(-26 * HOUR),
      round: {
        id: 30,
        asset: 'ETH',
        kind: 'main_daily',
        state: 'SETTLED',
        strike: 3120.5,
        close: 3188.2,
        outcome: 'UP',
        resolve_at: iso(-25 * HOUR),
      },
    },
    {
      id: 99,
      side: 'DOWN',
      confidence: 0,
      isCorrect: false,
      pointsEarned: 0,
      createdAt: iso(-29 * HOUR),
      round: {
        id: 29,
        asset: 'TON',
        kind: 'hourly',
        state: 'SETTLED',
        strike: 5.42,
        close: 5.51,
        outcome: 'UP',
        resolve_at: iso(-28 * HOUR),
      },
    },
    {
      id: 98,
      side: 'UP',
      confidence: 100,
      isCorrect: null,
      pointsEarned: 0,
      createdAt: iso(-30 * HOUR),
      round: {
        id: 28,
        asset: 'BTC',
        kind: 'hourly',
        state: 'VOIDED',
        strike: 64210,
        close: null,
        outcome: 'VOID',
        resolve_at: iso(-29 * HOUR),
      },
    },
  ]

  return { pending, settled }
}

export function demoLeaderboard(period: 'weekly' | 'season'): LeaderboardDto {
  const names = [
    'moon_caller',
    'satoshi_fan',
    'eth_maxi',
    'ton_whale',
    'diamond_hands',
    'chart_wizard',
    'btc_bull',
    'streaky_steve',
  ]
  const base = period === 'weekly' ? 4200 : 18750
  const leaderboard = names.map((username, i) => ({
    rank: i + 1,
    userId: i + 10,
    username,
    points: base - i * 310,
    isMe: username === 'satoshi_fan',
  }))

  const me = leaderboard.find((e) => e.isMe)!

  return {
    period,
    leaderboard,
    me: { rank: me.rank, userId: me.userId, username: me.username, points: me.points, isMe: true },
  }
}

export function demoReferralInfo(): ReferralInfoDto {
  return {
    link: 'https://t.me/builtbot_devbot?start=ref_100001',
    referralCode: 'ref_100001',
    activatedCount: 3,
    pendingCount: 1,
    overrideEarned: 215,
  }
}
