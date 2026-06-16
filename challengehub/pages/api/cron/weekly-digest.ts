/**
 * Weekly digest cron — scheduled at 08:00 UTC every Monday.
 * Posts a community summary to the Telegram channel (if configured)
 * and sends an individual DM to all users who have checked in at least once.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { sendWeeklyDigest } from '@/lib/notifications'

function weekLabel(): string {
  const now = new Date()
  const end = new Date(now)
  const start = new Date(now)
  start.setDate(now.getDate() - 7)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Top 5 users by XP
  const { data: topProfiles } = await supabase
    .from('challengehub_profiles')
    .select('user_id, xp, level')
    .order('xp', { ascending: false })
    .limit(5)

  const topUserIds = (topProfiles ?? []).map((p) => p.user_id)
  const { data: topUserData } = topUserIds.length > 0
    ? await supabase.from('users').select('id, username').in('id', topUserIds)
    : { data: [] }

  const usernameMap = Object.fromEntries((topUserData ?? []).map((u) => [u.id, u.username]))

  const topUsers = (topProfiles ?? []).map((p) => ({
    username: usernameMap[p.user_id] ?? null,
    xp: p.xp,
    level: p.level,
  }))

  // Active challenge count
  const { count: activeChallenges } = await supabase
    .from('challenges')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  // Total active participants
  const { count: totalParticipants } = await supabase
    .from('challenge_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('status', 'active')

  // Check-ins this week
  const { count: checkinsThisWeek } = await supabase
    .from('task_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', weekAgo)

  // New members this week
  const { count: newMembersThisWeek } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo)

  // Users who have participated at least once (eligible for DM)
  const { data: activeUsers } = await supabase
    .from('challengehub_profiles')
    .select('user_id')

  const { data: userTelegramIds } = (activeUsers && activeUsers.length > 0)
    ? await supabase
        .from('users')
        .select('telegram_id')
        .in('id', activeUsers.map((u) => u.user_id))
        .not('telegram_id', 'is', null)
    : { data: [] }

  const telegramIds = (userTelegramIds ?? [])
    .map((u) => u.telegram_id as number)
    .filter(Boolean)

  await sendWeeklyDigest(
    {
      weekLabel: weekLabel(),
      topUsers,
      activeChallenges: activeChallenges ?? 0,
      totalParticipants: totalParticipants ?? 0,
      checkinsThisWeek: checkinsThisWeek ?? 0,
      newMembersThisWeek: newMembersThisWeek ?? 0,
    },
    telegramIds,
  )

  console.log(`[cron/weekly-digest] sent to channel + ${telegramIds.length} users`)
  res.status(200).json({ ok: true, users: telegramIds.length })
}
