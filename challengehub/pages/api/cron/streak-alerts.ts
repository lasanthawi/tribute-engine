/**
 * Evening streak-alert cron — scheduled at 19:00 UTC.
 * Finds members with an active streak who have NOT checked in today and
 * sends an urgent (but non-spammy) alert before midnight.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { sendStreakAlert } from '@/lib/notifications'
import { getStreak } from '@/lib/xp'
import { sleep } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)

  const { data: challenges, error } = await supabase
    .from('challenges')
    .select('id, title, start_date')
    .eq('status', 'active')

  if (error) {
    console.error('[cron/streak-alerts] challenges query failed', error)
    return res.status(500).json({ error: 'db error' })
  }

  // Collect (userId, challengeId, taskId) for everyone who hasn't submitted today
  type PendingEntry = { userId: number; challengeId: number; taskId: number; taskTitle: string; dayNumber: number }
  const pending = new Map<number, PendingEntry>() // keyed by userId — one alert per user max

  for (const challenge of challenges ?? []) {
    const startUtc = new Date(challenge.start_date)
    startUtc.setUTCHours(0, 0, 0, 0)
    const dayNumber = Math.floor((todayUtc.getTime() - startUtc.getTime()) / 86_400_000) + 1
    if (dayNumber < 1) continue

    const { data: task } = await supabase
      .from('daily_tasks')
      .select('id, title')
      .eq('challenge_id', challenge.id)
      .eq('day', dayNumber)
      .maybeSingle()

    if (!task) continue

    const { data: submitted } = await supabase
      .from('task_submissions')
      .select('user_id')
      .eq('task_id', task.id)

    const doneIds = new Set((submitted ?? []).map((s) => s.user_id))

    const { data: members } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challenge.id)
      .eq('status', 'active')

    for (const m of members ?? []) {
      if (!doneIds.has(m.user_id) && !pending.has(m.user_id)) {
        pending.set(m.user_id, {
          userId: m.user_id,
          challengeId: challenge.id,
          taskId: task.id,
          taskTitle: task.title,
          dayNumber,
        })
      }
    }
  }

  if (pending.size === 0) {
    return res.status(200).json({ ok: true, sent: 0 })
  }

  const pendingUserIds = Array.from(pending.keys())
  const { data: users } = await supabase
    .from('users')
    .select('id, telegram_id, username')
    .in('id', pendingUserIds)

  // Map challengeId → title for alert messages
  const pendingChallengeIds = Array.from(new Set(Array.from(pending.values()).map((p) => p.challengeId)))
  const { data: challengeList } = await supabase
    .from('challenges')
    .select('id, title')
    .in('id', pendingChallengeIds)

  const challengeTitles = Object.fromEntries((challengeList ?? []).map((c) => [c.id, c.title]))

  let sent = 0
  for (const user of users ?? []) {
    if (!user.telegram_id) continue

    const entry = pending.get(user.id)
    if (!entry) continue

    // Only alert users who actually have an active streak worth protecting
    let streak = 0
    try {
      const s = await getStreak(user.id)
      streak = s.streak
      if (streak === 0) continue // no streak to protect — skip
    } catch { continue }

    await sendStreakAlert(user.telegram_id, {
      username: user.username,
      challengeTitle: challengeTitles[entry.challengeId] ?? 'your challenge',
      taskTitle: entry.taskTitle,
      dayNumber: entry.dayNumber,
      streak,
    })

    sent++
    await sleep(40)
  }

  console.log(`[cron/streak-alerts] sent=${sent}`)
  res.status(200).json({ ok: true, sent })
}
