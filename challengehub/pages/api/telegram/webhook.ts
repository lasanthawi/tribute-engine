import { NextApiRequest, NextApiResponse } from 'next'
import { sendHtml, TelegramUpdate } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'
import { createPendingReferral } from '@/lib/referral'
import { broadcastCustomMessage } from '@/lib/notifications'
import { getStreak, getUserXp } from '@/lib/xp'
import { levelProgress } from '@/lib/xp-client'
import {
  appKeyboard,
  welcomeMessage,
  progressBar,
  categoryEmoji,
  rankEmoji,
  todayTasksMessage,
  streakStatusMessage,
  rankStatusMessage,
  leaderboardMessage,
  adminStatsMessage,
} from '@/lib/bot-messages'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n) && n > 0)

function isAdmin(id: number) { return ADMIN_IDS.includes(id) }

function todayUtc() {
  const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d
}

async function upsertUser(telegramId: number, username?: string): Promise<{ id: number; isNew: boolean }> {
  const { data: existing } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()

  if (existing) {
    await supabase.from('users')
      .update({ last_seen_at: new Date().toISOString(), username: username ?? null })
      .eq('id', existing.id)
    const { data: profile } = await supabase
      .from('challengehub_profiles').select('user_id').eq('user_id', existing.id).maybeSingle()
    if (!profile) {
      await supabase.from('challengehub_profiles').insert({ user_id: existing.id, xp: 0, level: 1 })
    }
    return { id: existing.id, isNew: false }
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ telegram_id: telegramId, username: username ?? null, last_seen_at: new Date().toISOString() })
    .select('id').single()
  if (error) throw error

  await supabase.from('challengehub_profiles').insert({ user_id: created.id, xp: 0, level: 1 })
  return { id: created.id, isNew: true }
}

// ─── /start ───────────────────────────────────────────────────────────────────

async function handleStart(chatId: number, telegramId: number, username: string | undefined, payload: string) {
  const { id: userId, isNew } = await upsertUser(telegramId, username)

  if (payload.startsWith('ref_')) {
    const referrerTgId = Number(payload.slice(4))
    if (!Number.isNaN(referrerTgId)) {
      await createPendingReferral(userId, referrerTgId)
    }
  }

  const { xp, level } = await getUserXp(userId)
  const { streak } = await getStreak(userId)
  const progress = levelProgress(xp, level)

  const { data: memberships } = await supabase
    .from('challenge_members')
    .select('challenge_id, challenges(title)')
    .eq('user_id', userId)
    .eq('status', 'active')

  const activeChallenges = (memberships ?? [])
    .map((m: any) => m.challenges?.title).filter(Boolean) as string[]

  const text = welcomeMessage({ username, isNew, xp, level, xpProgress: progress, streak, activeChallenges })
  await sendHtml(BOT_TOKEN, chatId, text, appKeyboard(isNew ? '🚀 Get Started' : '▶ Open ChallengeHub'))
}

// ─── /today ───────────────────────────────────────────────────────────────────

async function handleToday(chatId: number, telegramId: number, username?: string) {
  const { data: user } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (!user) {
    await sendHtml(BOT_TOKEN, chatId, 'Start with /start first!', appKeyboard())
    return
  }

  const today = todayUtc()

  const { data: memberships } = await supabase
    .from('challenge_members')
    .select('challenge_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const challengeIds = (memberships ?? []).map((m) => m.challenge_id)
  if (challengeIds.length === 0) {
    await sendHtml(BOT_TOKEN, chatId,
      `📋 <b>Today's Tasks</b>\n\nYou have no active challenges. Join one to get started!`,
      appKeyboard('🔍 Browse Challenges'))
    return
  }

  const { data: challenges } = await supabase
    .from('challenges')
    .select('id, title, category, start_date')
    .in('id', challengeIds)
    .eq('status', 'active')

  const tasks: Parameters<typeof todayTasksMessage>[0]['tasks'] = []

  for (const c of challenges ?? []) {
    const startUtc = new Date(c.start_date); startUtc.setUTCHours(0, 0, 0, 0)
    const dayNumber = Math.floor((today.getTime() - startUtc.getTime()) / 86_400_000) + 1
    if (dayNumber < 1) continue

    const { data: task } = await supabase
      .from('daily_tasks').select('id, title, xp_reward')
      .eq('challenge_id', c.id).eq('day', dayNumber).maybeSingle()
    if (!task) continue

    const { count: totalDays } = await supabase
      .from('daily_tasks').select('id', { count: 'exact', head: true }).eq('challenge_id', c.id)

    const { data: sub } = await supabase
      .from('task_submissions').select('id').eq('user_id', user.id).eq('task_id', task.id).maybeSingle()

    tasks.push({
      challengeTitle: c.title,
      category: c.category ?? 'general',
      taskTitle: task.title,
      dayNumber,
      totalDays: totalDays ?? dayNumber,
      done: !!sub,
      xpReward: task.xp_reward,
    })
  }

  const text = todayTasksMessage({ username, tasks })
  await sendHtml(BOT_TOKEN, chatId, text, appKeyboard('✅ Check In'))
}

// ─── /streak ──────────────────────────────────────────────────────────────────

async function handleStreak(chatId: number, telegramId: number, username?: string) {
  const { data: user } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (!user) {
    await sendHtml(BOT_TOKEN, chatId, 'Start with /start first!', appKeyboard())
    return
  }

  const { streak, atRisk } = await getStreak(user.id)
  const checkedInToday = streak > 0 && !atRisk

  const text = streakStatusMessage({ username, streak, atRisk, checkedInToday })
  await sendHtml(BOT_TOKEN, chatId, text, appKeyboard())
}

// ─── /rank ────────────────────────────────────────────────────────────────────

async function handleRank(chatId: number, telegramId: number, username?: string) {
  const { data: user } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (!user) {
    await sendHtml(BOT_TOKEN, chatId, 'Start with /start first!', appKeyboard())
    return
  }

  const { xp, level } = await getUserXp(user.id)
  const { count: totalPlayers } = await supabase
    .from('challengehub_profiles').select('user_id', { count: 'exact', head: true })

  const { count: playersAhead } = await supabase
    .from('challengehub_profiles')
    .select('user_id', { count: 'exact', head: true })
    .gt('xp', xp)

  const rank = (playersAhead ?? 0) + 1
  const text = rankStatusMessage({ username, rank, totalPlayers: totalPlayers ?? rank, xp, level })
  await sendHtml(BOT_TOKEN, chatId, text, appKeyboard())
}

// ─── /top ─────────────────────────────────────────────────────────────────────

async function handleTop(chatId: number, telegramId: number, username?: string) {
  const { data: top } = await supabase
    .from('challengehub_profiles').select('user_id, xp, level')
    .order('xp', { ascending: false }).limit(5)

  const ids = (top ?? []).map((p) => p.user_id)
  const { data: usersData } = ids.length > 0
    ? await supabase.from('users').select('id, username').in('id', ids)
    : { data: [] }

  const uMap = Object.fromEntries((usersData ?? []).map((u) => [u.id, u.username]))

  const topUsers = (top ?? []).map((p) => ({
    username: uMap[p.user_id] ?? null,
    xp: p.xp,
    level: p.level,
  }))

  // Current user's rank
  let myRank: number | undefined
  let myXp: number | undefined

  const { data: me } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).maybeSingle()
  if (me) {
    const { xp } = await getUserXp(me.id)
    const { count: ahead } = await supabase
      .from('challengehub_profiles').select('user_id', { count: 'exact', head: true }).gt('xp', xp)
    myRank = (ahead ?? 0) + 1
    myXp = xp
  }

  const text = leaderboardMessage({ topUsers, myRank, myXp, myUsername: username })
  await sendHtml(BOT_TOKEN, chatId, text, appKeyboard())
}

// ─── /stats (admin) ──────────────────────────────────────────────────────────

async function handleStats(chatId: number) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayStart = todayUtc().toISOString()

  const [
    { count: totalUsers },
    { count: dau },
    { count: newThisWeek },
    { count: activeChallenges },
    { count: totalMembers },
    { count: checkinsToday },
    { count: checkinsThisWeek },
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('last_seen_at', todayStart),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('challenge_members').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('task_submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', todayStart),
    supabase.from('task_submissions').select('id', { count: 'exact', head: true }).gte('submitted_at', weekAgo),
  ])

  const text = adminStatsMessage({
    totalUsers: totalUsers ?? 0,
    dau: dau ?? 0,
    newThisWeek: newThisWeek ?? 0,
    activeChallenges: activeChallenges ?? 0,
    totalMembers: totalMembers ?? 0,
    checkinsToday: checkinsToday ?? 0,
    checkinsThisWeek: checkinsThisWeek ?? 0,
  })

  await sendHtml(BOT_TOKEN, chatId, text)
}

// ─── /broadcast (admin) ──────────────────────────────────────────────────────

async function handleBroadcast(chatId: number, text: string) {
  if (!text) {
    await sendHtml(BOT_TOKEN, chatId, 'Usage: /broadcast &lt;message&gt;')
    return
  }
  const { data: users } = await supabase.from('users').select('telegram_id')
  const count = await broadcastCustomMessage((users ?? []).map((u) => u.telegram_id), text)
  await sendHtml(BOT_TOKEN, chatId, `✅ Broadcast sent to <b>${count}</b> user(s).`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const msg = update.message
    if (!msg?.text || !msg.from) return res.status(200).json({ ok: true })

    const { id: telegramId, username } = msg.from
    const { id: chatId } = msg.chat
    const text = msg.text.trim()

    // Admin-only commands
    if (isAdmin(telegramId)) {
      if (text === '/stats') { await handleStats(chatId); return res.status(200).json({ ok: true }) }
      if (text.startsWith('/broadcast')) {
        await handleBroadcast(chatId, text.slice('/broadcast'.length).trim())
        return res.status(200).json({ ok: true })
      }
    }

    // Public commands
    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1] ?? ''
      await handleStart(chatId, telegramId, username, payload)
    } else if (text === '/today' || text.startsWith('/today ')) {
      await handleToday(chatId, telegramId, username)
    } else if (text === '/streak' || text.startsWith('/streak ')) {
      await handleStreak(chatId, telegramId, username)
    } else if (text === '/rank' || text.startsWith('/rank ')) {
      await handleRank(chatId, telegramId, username)
    } else if (text === '/top' || text.startsWith('/top ')) {
      await handleTop(chatId, telegramId, username)
    } else if (text === '/help') {
      await sendHtml(BOT_TOKEN, chatId, [
        `🏆 <b>ChallengeHub Commands</b>`,
        ``,
        `/start — Welcome & your profile`,
        `/today — Today's pending tasks`,
        `/streak — Your check-in streak`,
        `/rank — Your global ranking`,
        `/top — Top 5 leaderboard`,
      ].join('\n'), appKeyboard())
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[telegram/webhook]', err)
    res.status(200).json({ ok: true }) // always 200 — prevents Telegram retry storm
  }
}
