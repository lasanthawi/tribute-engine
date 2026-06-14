import type {
  CallDto,
  CoinPackageDto,
  GameDto,
  LeaderboardDto,
  MeDto,
  ProfileDto,
  QuestDto,
  ReferralInfoDto,
  RoundDto,
  SentimentDto,
} from './api-client'
import { COIN_PACKAGES } from './coins'
import { getLeagueProgress } from './league'

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
    coins: 320,
    streak: 4,
    streakMultiplier: 1.4,
    dailyBonusAwarded: false,
    dailyBonusAmount: 50,
    confidenceBoosts: 1,
    streakFreezes: 0,
  }
}

export function demoGames(): { games: GameDto[] } {
  return {
    games: [
      {
        slug: 'tap',
        template: 'tap_catch',
        title: 'Coin Catcher',
        description: 'Tap falling BTC/ETH/TON coins for 30 seconds',
        icon: '🪙',
        config: {
          durationSec: 30,
          spawnMinMs: 600,
          spawnMaxMs: 900,
          objects: [
            { id: 'BTC', label: '₿', color: '#F7931A', weight: 1, iconUrl: '/games/icons/btc.svg' },
            { id: 'ETH', label: 'Ξ', color: '#627EEA', weight: 1, iconUrl: '/games/icons/eth.svg' },
            { id: 'TON', label: '◆', color: '#0098EA', weight: 1, iconUrl: '/games/icons/ton.svg' },
          ],
          rewardCurve: [
            { minScore: 0, points: 0 },
            { minScore: 1, points: 5 },
            { minScore: 5, points: 10 },
            { minScore: 10, points: 15 },
            { minScore: 15, points: 20 },
            { minScore: 20, points: 30 },
            { minScore: 30, points: 40 },
          ],
          maxScore: 60,
          theme: { bg: '#0b0f1a', accent: '#6c5ce7' },
        },
        coverImageUrl: '/games/tap-cover.svg',
        remainingPlays: 2,
        maxPlaysPerDay: 3,
      },
      {
        slug: 'spin',
        template: 'spin_wheel',
        title: 'Daily Spin',
        description: 'One free spin every day for bonus rewards',
        icon: '🎡',
        config: {
          segments: [
            { label: '10 pts', weight: 30, rewardPoints: 10, rewardTickets: 0, rewardCoins: 0 },
            { label: '20 pts', weight: 25, rewardPoints: 20, rewardTickets: 0, rewardCoins: 0 },
            { label: '50 pts', weight: 18, rewardPoints: 50, rewardTickets: 0, rewardCoins: 0 },
            { label: '5 coins', weight: 12, rewardPoints: 0, rewardTickets: 0, rewardCoins: 5 },
            { label: '100 pts', weight: 10, rewardPoints: 100, rewardTickets: 0, rewardCoins: 0 },
            { label: '1 ticket', weight: 4, rewardPoints: 0, rewardTickets: 1, rewardCoins: 0 },
            { label: 'Jackpot 250', weight: 1, rewardPoints: 250, rewardTickets: 0, rewardCoins: 0 },
          ],
        },
        coverImageUrl: '/games/spin-cover.svg',
        remainingPlays: 1,
        maxPlaysPerDay: 1,
      },
      {
        slug: 'snake',
        template: 'snake_run',
        title: 'Snake Run',
        description: 'Steer your snake to eat glowing orbs for 45 seconds — avoid walls, your tail, and blocks',
        icon: '🐍',
        config: {
          gridSize: 16,
          tickMs: 200,
          durationSec: 45,
          wrap: false,
          obstacles: 4,
          speedRamp: 0.01,
          theme: { bg: '#0b0f1a', accent: '#21d07a', food: '#ff5c5c' },
          rewardCurve: [
            { minScore: 0, points: 0 },
            { minScore: 2, points: 5 },
            { minScore: 4, points: 10 },
            { minScore: 6, points: 15 },
            { minScore: 9, points: 20 },
            { minScore: 12, points: 30 },
            { minScore: 16, points: 40 },
          ],
          maxScore: 20,
        },
        coverImageUrl: '/games/snake-cover.svg',
        remainingPlays: 3,
        maxPlaysPerDay: 3,
      },
      {
        slug: 'gomoku',
        template: 'gomoku',
        title: 'Gomoku Blitz',
        description: '8x8 connect-5 vs Nova or a live remote player',
        icon: 'GX',
        config: {},
        coverImageUrl: '/games/gomoku-cover.svg',
        remainingPlays: 1,
        maxPlaysPerDay: 1,
      },
    ],
  }
}

export function demoCoinPackages(): CoinPackageDto[] {
  return COIN_PACKAGES
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
      sentiment: { up: 184, down: 121, total: 305 },
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
      sentiment: { up: 58, down: 47, total: 105 },
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
      sentiment: { up: 33, down: 51, total: 84 },
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
      sentiment: { up: 19, down: 17, total: 36 },
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

export function demoSentiment(): SentimentDto {
  return {
    fearGreed: { score: 64, label: 'Greed', updatedAt: iso(-2 * HOUR) },
    headlines: [
      {
        id: 'demo-1',
        title: 'Bitcoin holds above key support as ETF inflows continue',
        url: 'https://example.com/news/1',
        source: 'CryptoDaily',
        sentiment: 'positive',
        publishedAt: iso(-30 * MIN),
      },
      {
        id: 'demo-2',
        title: 'Ethereum gas fees spike amid network congestion',
        url: 'https://example.com/news/2',
        source: 'CoinDesk',
        sentiment: 'negative',
        publishedAt: iso(-90 * MIN),
      },
      {
        id: 'demo-3',
        title: 'TON ecosystem sees growing developer activity',
        url: 'https://example.com/news/3',
        source: 'The Block',
        sentiment: 'neutral',
        publishedAt: iso(-3 * HOUR),
      },
    ],
  }
}

export function demoQuests(): { quests: QuestDto[] } {
  return {
    quests: [
      {
        id: 1,
        code: 'daily_vote_3',
        title: 'Triple Vote',
        description: 'Cast 3 votes today',
        type: 'daily',
        progress: 2,
        target: 3,
        rewardType: 'coins',
        rewardAmount: 10,
        rewardPerkType: null,
        rewardType2: null,
        rewardAmount2: null,
        rewardPerkType2: null,
        completed: false,
        claimed: false,
      },
      {
        id: 2,
        code: 'daily_correct_1',
        title: 'Sharp Eye',
        description: 'Get 1 correct call today',
        type: 'daily',
        progress: 1,
        target: 1,
        rewardType: 'coins',
        rewardAmount: 5,
        rewardPerkType: null,
        rewardType2: null,
        rewardAmount2: null,
        rewardPerkType2: null,
        completed: true,
        claimed: false,
      },
      {
        id: 3,
        code: 'weekly_vote_15',
        title: 'Vote Machine',
        description: 'Cast 15 votes this week',
        type: 'weekly',
        progress: 9,
        target: 15,
        rewardType: 'tickets',
        rewardAmount: 1,
        rewardPerkType: null,
        rewardType2: 'coins',
        rewardAmount2: 50,
        rewardPerkType2: null,
        completed: false,
        claimed: false,
      },
      {
        id: 4,
        code: 'weekly_streak',
        title: 'Hot Streak',
        description: 'Maintain your streak all week',
        type: 'weekly',
        progress: 7,
        target: 7,
        rewardType: 'perk',
        rewardAmount: 1,
        rewardPerkType: 'confidence_boost',
        rewardType2: null,
        rewardAmount2: null,
        rewardPerkType2: null,
        completed: true,
        claimed: true,
      },
    ],
  }
}

export function demoProfile(): ProfileDto {
  const points = 2480
  const progress = getLeagueProgress(points)
  return {
    username: 'satoshi_fan',
    totalVotes: 87,
    totalCorrect: 52,
    accuracy: Math.round((52 / 87) * 100),
    bestStreak: 9,
    currentStreak: 4,
    points,
    league: {
      current: { name: progress.current.name, icon: progress.current.icon, color: progress.current.color },
      next: progress.next
        ? {
            name: progress.next.name,
            icon: progress.next.icon,
            color: progress.next.color,
            minPoints: progress.next.minPoints,
          }
        : null,
      progress: progress.progress,
      remaining: progress.remaining,
    },
    achievements: [
      { code: 'first_call', title: 'First Call', description: 'Cast your first vote', icon: '🎯', unlocked: true, unlockedAt: iso(-20 * 24 * HOUR), progress: null, target: null },
      { code: 'first_win', title: 'First Win', description: 'Get your first correct call', icon: '🏆', unlocked: true, unlockedAt: iso(-19 * 24 * HOUR), progress: null, target: null },
      { code: 'streak_3', title: 'Warming Up', description: 'Reach a 3-day streak', icon: '🔥', unlocked: true, unlockedAt: iso(-10 * 24 * HOUR), progress: null, target: null },
      { code: 'streak_7', title: 'On Fire', description: 'Reach a 7-day streak', icon: '🔥', unlocked: false, unlockedAt: null, progress: 4, target: 7 },
      { code: 'streak_30', title: 'Unstoppable', description: 'Reach a 30-day streak', icon: '🔥', unlocked: false, unlockedAt: null, progress: 4, target: 30 },
      { code: 'correct_10', title: 'Sharp Shooter', description: 'Get 10 correct calls', icon: '🎯', unlocked: true, unlockedAt: iso(-15 * 24 * HOUR), progress: null, target: null },
      { code: 'correct_50', title: 'Master Predictor', description: 'Get 50 correct calls', icon: '🧠', unlocked: true, unlockedAt: iso(-2 * 24 * HOUR), progress: null, target: null },
      { code: 'correct_100', title: 'Oracle', description: 'Get 100 correct calls', icon: '🔮', unlocked: false, unlockedAt: null, progress: 52, target: 100 },
      { code: 'perfect_day', title: 'Perfect Day', description: 'Get 3+ correct calls in a single day', icon: '⭐', unlocked: true, unlockedAt: iso(-5 * 24 * HOUR), progress: null, target: null },
      { code: 'league_silver', title: 'Silver League', description: 'Reach the Silver league', icon: '🥈', unlocked: false, unlockedAt: null, progress: points, target: 5000 },
      { code: 'league_gold', title: 'Gold League', description: 'Reach the Gold league', icon: '🥇', unlocked: false, unlockedAt: null, progress: points, target: 15000 },
      { code: 'league_platinum', title: 'Platinum League', description: 'Reach the Platinum league', icon: '💎', unlocked: false, unlockedAt: null, progress: points, target: 40000 },
      { code: 'league_diamond', title: 'Diamond League', description: 'Reach the Diamond league', icon: '💠', unlocked: false, unlockedAt: null, progress: points, target: 100000 },
    ],
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
