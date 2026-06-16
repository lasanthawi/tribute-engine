/**
 * Rich Telegram message templates for ChallengeHub.
 * All messages use HTML parse_mode and are designed for mobile readability.
 */

const DIV = '─────────────────────'

/** Unicode block progress bar (e.g. ▰▰▰▱▱▱ 50%) */
export function progressBar(current: number, total: number, width = 8): string {
  const pct = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0
  const filled = Math.round(pct * width)
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

/** XP-style fill bar using block chars (e.g. ████░░░░) */
export function xpBar(progress: number, width = 8): string {
  const filled = Math.round(Math.min(Math.max(progress, 0), 1) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    wellness: '🧘',
    fitness: '💪',
    finance: '💰',
    learning: '📚',
    digital_wellness: '📵',
    creator: '🎨',
    general: '⚡',
  }
  return map[category] ?? '⚡'
}

export function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

export function streakFlame(streak: number): string {
  if (streak >= 30) return '⚡🔥⚡'
  if (streak >= 14) return '🔥🔥'
  return '🔥'
}

function nameTag(username?: string | null): string {
  return username ? `@${username}` : 'Hey'
}

/** Inline keyboard that opens the Mini App */
export function appKeyboard(label = '▶ Open ChallengeHub'): object | undefined {
  const url = process.env.MINI_APP_URL
  if (!url) return undefined
  return { inline_keyboard: [[{ text: label, web_app: { url } }]] }
}

/** Join challenge keyboard */
export function joinKeyboard(): object | undefined {
  const url = process.env.MINI_APP_URL
  if (!url) return undefined
  return { inline_keyboard: [[{ text: '🚀 Join Now', web_app: { url } }]] }
}

// ─── Message templates ────────────────────────────────────────────────────────

export interface WelcomeOpts {
  username?: string | null
  isNew: boolean
  xp: number
  level: number
  xpProgress: number // 0-1
  streak: number
  activeChallenges: string[]
}

export function welcomeMessage(o: WelcomeOpts): string {
  const xpNeeded = Math.pow(o.level, 2) * 100 - o.xp
  const bar = xpBar(o.xpProgress)
  const lines: string[] = [
    `🏆 <b>ChallengeHub</b>`,
    '',
    o.isNew
      ? 'Build powerful daily habits through community challenges. Complete tasks, earn XP, and climb the leaderboard.'
      : `Welcome back, ${nameTag(o.username)}! 👋`,
    '',
    `<b>${DIV}</b>`,
    `✨ <b>Your Profile</b>`,
    `Level <b>${o.level}</b> · <b>${o.xp.toLocaleString()}</b> XP`,
    `${bar} → Lv.${o.level + 1} in ${Math.max(0, xpNeeded)} XP`,
  ]

  if (o.streak > 0) {
    lines.push(`${streakFlame(o.streak)} <b>${o.streak}-day streak</b> — keep it going!`)
  }

  if (o.activeChallenges.length > 0) {
    lines.push('', `<b>${DIV}</b>`, `🎯 <b>Active Challenges</b>`)
    o.activeChallenges.slice(0, 3).forEach((t) => lines.push(`• ${t}`))
  } else if (o.isNew) {
    lines.push('', `<b>${DIV}</b>`, `Ready to start your first challenge? Browse 7-day programs in fitness, wellness, learning, and more.`)
  }

  lines.push('', 'Tap below to open your dashboard 👇')
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface DailyReminderOpts {
  username?: string | null
  challengeTitle: string
  category: string
  taskTitle: string
  taskDesc?: string | null
  xpReward: number
  dayNumber: number
  totalDays: number
  streak: number
}

export function dailyReminderMessage(o: DailyReminderOpts): string {
  const cat = categoryEmoji(o.category)
  const bar = progressBar(o.dayNumber - 1, o.totalDays)
  const pct = Math.round(((o.dayNumber - 1) / o.totalDays) * 100)

  const lines = [
    `⏰ <b>Check-in time, ${nameTag(o.username)}!</b>`,
    '',
    `<b>${DIV}</b>`,
    `${cat} <b>${o.challengeTitle}</b>`,
    `Day ${o.dayNumber} of ${o.totalDays} · ${bar} ${pct}%`,
    '',
    `📋 <b>Today's task</b>`,
    `<i>${o.taskTitle}</i>`,
  ]

  if (o.taskDesc) {
    lines.push('', o.taskDesc)
  }

  lines.push(
    '',
    `<b>${DIV}</b>`,
    `⚡ Complete now → earn <b>+${o.xpReward} XP</b>`,
  )

  if (o.streak > 0) {
    lines.push(`${streakFlame(o.streak)} Keep your <b>${o.streak}-day streak</b> alive!`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface StreakAlertOpts {
  username?: string | null
  challengeTitle: string
  taskTitle: string
  dayNumber: number
  streak: number
}

export function streakAlertMessage(o: StreakAlertOpts): string {
  const flames = streakFlame(o.streak)
  return [
    `⚠️ <b>Streak at risk, ${nameTag(o.username)}!</b>`,
    '',
    `Don't lose your ${flames} <b>${o.streak}-day streak</b>!`,
    '',
    `<b>${DIV}</b>`,
    `🎯 <b>${o.challengeTitle}</b>`,
    `<i>Day ${o.dayNumber} · ${o.taskTitle}</i>`,
    '',
    `⏳ Time is running out — midnight is the deadline.`,
    `One check-in keeps the chain alive!`,
    `<b>${DIV}</b>`,
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ChallengeGoLiveOpts {
  title: string
  category: string
  description: string
  durationDays: number
  memberCount: number
  totalXp: number
  rewardTitle?: string | null
}

export function challengeGoLiveMessage(o: ChallengeGoLiveOpts): string {
  const cat = categoryEmoji(o.category)
  const catLabel = o.category.replace('_', ' ')
  const lines = [
    `🚀 <b>New Challenge Live!</b>`,
    '',
    `${cat} <b>${o.title}</b>`,
    `<i>${catLabel} · ${o.durationDays} days</i>`,
    '',
    o.description,
    '',
    `<b>${DIV}</b>`,
    `🎯 <b>What you'll earn</b>`,
    `• Up to <b>${o.totalXp} XP</b> on completion`,
  ]

  if (o.rewardTitle) {
    lines.push(`• ${o.rewardTitle} 🏅`)
  }

  if (o.memberCount > 0) {
    lines.push('', `👥 <b>${o.memberCount}</b> ${o.memberCount === 1 ? 'member' : 'members'} already joined!`)
  }

  lines.push('', `Tap below to join and start Day 1 👇`)
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface LevelUpOpts {
  username?: string | null
  newLevel: number
  xp: number
  xpProgress: number
  streak: number
  activeChallenges: number
}

export function levelUpMessage(o: LevelUpOpts): string {
  const bar = xpBar(o.xpProgress)
  const xpNeeded = Math.pow(o.newLevel, 2) * 100 - o.xp
  return [
    `🎉 <b>Level Up!</b>`,
    '',
    `Incredible work, ${nameTag(o.username)}!`,
    `You've reached <b>Level ${o.newLevel}</b> 🏆`,
    '',
    `<b>${DIV}</b>`,
    `⚡ <b>${o.xp.toLocaleString()} XP</b> total earned`,
    `${bar} → Lv.${o.newLevel + 1} in ${Math.max(0, xpNeeded)} XP`,
    '',
    o.streak > 0 ? `${streakFlame(o.streak)} ${o.streak}-day streak` : '',
    o.activeChallenges > 0 ? `🎯 ${o.activeChallenges} active challenge${o.activeChallenges > 1 ? 's' : ''}` : '',
    `<b>${DIV}</b>`,
    `You're on fire — keep building! 💪`,
  ].filter((l) => l !== '').join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ChallengeCompleteOpts {
  username?: string | null
  challengeTitle: string
  tasksCompleted: number
  totalXpEarned: number
  hasReward: boolean
}

export function challengeCompleteMessage(o: ChallengeCompleteOpts): string {
  return [
    `🏁 <b>Challenge Complete!</b>`,
    '',
    `You finished <b>${o.challengeTitle}</b>, ${nameTag(o.username)}! 🎊`,
    '',
    `<b>${DIV}</b>`,
    `✅ <b>${o.tasksCompleted}</b> tasks completed`,
    `⚡ <b>+${o.totalXpEarned} XP</b> earned`,
    o.hasReward ? `🎁 Your reward is waiting — open the app to claim it!` : '',
    `<b>${DIV}</b>`,
    `What an achievement. Now, what's next? 🚀`,
  ].filter((l) => l !== '').join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyDigestOpts {
  weekLabel: string
  topUsers: { username?: string | null; xp: number; level: number }[]
  activeChallenges: number
  totalParticipants: number
  checkinsThisWeek: number
  newMembersThisWeek: number
}

export function weeklyDigestMessage(o: WeeklyDigestOpts): string {
  const topLines = o.topUsers.slice(0, 3).map((u, i) => {
    const name = u.username ? `@${u.username}` : `Player ${i + 1}`
    return `${rankEmoji(i + 1)} ${name} · <b>${u.xp.toLocaleString()} XP</b> · Lv.${u.level}`
  })

  const lines = [
    `📊 <b>ChallengeHub Weekly</b>`,
    `<i>${o.weekLabel}</i>`,
    `<b>${DIV}</b>`,
  ]

  if (topLines.length > 0) {
    lines.push('🏆 <b>Top Performers</b>', ...topLines, '')
  }

  lines.push(
    `💪 <b>Active this week</b>`,
    `${o.activeChallenges} challenges · ${o.totalParticipants} participants`,
    '',
    `📈 <b>Community</b>`,
    `${o.checkinsThisWeek} check-ins completed`,
    `${o.newMembersThisWeek} new members joined`,
    '',
    `<b>${DIV}</b>`,
    `Keep showing up — every day counts! 🌟`,
  )

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface TodayTasksOpts {
  username?: string | null
  tasks: {
    challengeTitle: string
    category: string
    taskTitle: string
    dayNumber: number
    totalDays: number
    done: boolean
    xpReward: number
  }[]
}

export function todayTasksMessage(o: TodayTasksOpts): string {
  if (o.tasks.length === 0) {
    return [
      `📋 <b>Today's Tasks</b>`,
      '',
      `No active challenge tasks for today.`,
      `Browse challenges below to get started! 👇`,
    ].join('\n')
  }

  const pending = o.tasks.filter((t) => !t.done)
  const lines = [`📋 <b>Today's Tasks, ${nameTag(o.username)}</b>`, '']

  for (const t of o.tasks) {
    const cat = categoryEmoji(t.category)
    const bar = progressBar(t.dayNumber - 1, t.totalDays, 6)
    const status = t.done ? '✅ Done' : '⏳ Pending'
    lines.push(
      `<b>${DIV}</b>`,
      `${cat} <b>${t.challengeTitle}</b>`,
      `Day ${t.dayNumber}/${t.totalDays} · ${bar}`,
      `<i>${t.taskTitle}</i>`,
      `${status}${!t.done ? ` → +${t.xpReward} XP` : ''}`,
    )
  }

  lines.push(`<b>${DIV}</b>`)
  if (pending.length > 0) {
    lines.push(`⚡ <b>${pending.length}</b> task${pending.length > 1 ? 's' : ''} remaining today!`)
  } else {
    lines.push(`🎉 All done for today — great work!`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface StreakStatusOpts {
  username?: string | null
  streak: number
  atRisk: boolean
  checkedInToday: boolean
}

export function streakStatusMessage(o: StreakStatusOpts): string {
  const flames = o.streak > 0 ? streakFlame(o.streak) : '—'
  const statusLine = o.checkedInToday
    ? `✅ Checked in today — streak is safe!`
    : o.streak > 0
    ? `⚠️ Not checked in yet today — streak at risk!`
    : `No active streak yet — start one today!`

  return [
    `🔥 <b>Your Streak</b>`,
    '',
    `<b>${DIV}</b>`,
    o.streak > 0 ? `${flames} <b>${o.streak}-day</b> streak` : `No streak yet`,
    statusLine,
    `<b>${DIV}</b>`,
    `<i>Consistency compounds. Every day you show up is a win.</i>`,
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface RankStatusOpts {
  username?: string | null
  rank: number
  totalPlayers: number
  xp: number
  level: number
}

export function rankStatusMessage(o: RankStatusOpts): string {
  const pctBetter = o.totalPlayers > 1
    ? Math.round(((o.totalPlayers - o.rank) / (o.totalPlayers - 1)) * 100)
    : 100
  return [
    `🏅 <b>Your Ranking, ${nameTag(o.username)}</b>`,
    '',
    `<b>${DIV}</b>`,
    `🌍 Global: <b>#${o.rank}</b> of ${o.totalPlayers} players`,
    `⚡ <b>${o.xp.toLocaleString()} XP</b> · Level ${o.level}`,
    '',
    pctBetter > 0 ? `You're ahead of <b>${pctBetter}%</b> of all players!` : `Keep earning XP to climb higher!`,
    `<b>${DIV}</b>`,
    `<i>Keep earning XP to climb the leaderboard!</i>`,
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderboardOpts {
  topUsers: { username?: string | null; xp: number; level: number }[]
  myRank?: number
  myXp?: number
  myUsername?: string | null
}

export function leaderboardMessage(o: LeaderboardOpts): string {
  const lines = [`🏆 <b>Leaderboard · Top ${o.topUsers.length}</b>`, '', `<b>${DIV}</b>`]

  o.topUsers.forEach((u, i) => {
    const name = u.username ? `@${u.username}` : `Player ${i + 1}`
    lines.push(`${rankEmoji(i + 1)} ${name} · <b>${u.xp.toLocaleString()} XP</b> · Lv.${u.level}`)
  })

  lines.push(`<b>${DIV}</b>`)

  if (o.myRank !== undefined && o.myXp !== undefined) {
    const name = o.myUsername ? `@${o.myUsername}` : 'You'
    lines.push(`You: ${name} · <b>#${o.myRank}</b> · ${o.myXp.toLocaleString()} XP`)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────

export interface AdminStatsOpts {
  totalUsers: number
  dau: number
  newThisWeek: number
  activeChallenges: number
  totalMembers: number
  checkinsToday: number
  checkinsThisWeek: number
}

export function adminStatsMessage(o: AdminStatsOpts): string {
  const dauPct = o.totalUsers > 0 ? Math.round((o.dau / o.totalUsers) * 100) : 0
  return [
    `📊 <b>ChallengeHub Dashboard</b>`,
    `<b>${DIV}</b>`,
    '',
    `👥 <b>Users</b>`,
    `Total: <b>${o.totalUsers}</b>`,
    `Active today (DAU): <b>${o.dau}</b> (${dauPct}%)`,
    `New this week: <b>${o.newThisWeek}</b>`,
    '',
    `🏆 <b>Challenges</b>`,
    `Live now: <b>${o.activeChallenges}</b>`,
    `Total members: <b>${o.totalMembers}</b>`,
    `Check-ins today: <b>${o.checkinsToday}</b>`,
    `Check-ins this week: <b>${o.checkinsThisWeek}</b>`,
    '',
    `<b>${DIV}</b>`,
  ].join('\n')
}
