/**
 * Daily morning reminder cron — scheduled at 09:00 UTC.
 * Finds members of active challenges who have NOT yet submitted today's task
 * and sends them a personalised check-in reminder via Telegram.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { sendDailyReminder } from '@/lib/notifications'
import { getStreak } from '@/lib/xp'
import { sleep } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)

  // 1. All currently active challenges
  const { data: challenges, error: cErr } = await supabase
    .from('challenges')
    .select('id, title, category, start_date')
    .eq('status', 'active')

  if (cErr) {
    console.error('[cron/send-reminders] challenges query failed', cErr)
    return res.status(500).json({ error: 'db error' })
  }

  let totalSent = 0
  let totalSkipped = 0

  for (const challenge of challenges ?? []) {
    // Calculate which day of the challenge today is
    const startUtc = new Date(challenge.start_date)
    startUtc.setUTCHours(0, 0, 0, 0)
    const dayNumber = Math.floor((todayUtc.getTime() - startUtc.getTime()) / 86_400_000) + 1
    if (dayNumber < 1) continue

    // Today's task for this challenge
    const { data: task } = await supabase
      .from('daily_tasks')
      .select('id, title, description, xp_reward')
      .eq('challenge_id', challenge.id)
      .eq('day', dayNumber)
      .maybeSingle()

    if (!task) continue

    // Total task count (for progress bar)
    const { count: totalDays } = await supabase
      .from('daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id)

    // Users who already submitted today's task
    const { data: submitted } = await supabase
      .from('task_submissions')
      .select('user_id')
      .eq('task_id', task.id)

    const doneIds = new Set((submitted ?? []).map((s) => s.user_id))

    // Active members of this challenge
    const { data: members } = await supabase
      .from('challenge_members')
      .select('user_id')
      .eq('challenge_id', challenge.id)
      .eq('status', 'active')

    const pendingIds = (members ?? []).filter((m) => !doneIds.has(m.user_id)).map((m) => m.user_id)
    if (pendingIds.length === 0) continue

    // Fetch Telegram IDs for pending members
    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id, username')
      .in('id', pendingIds)

    for (const user of users ?? []) {
      if (!user.telegram_id) { totalSkipped++; continue }

      let streak = 0
      try {
        const s = await getStreak(user.id)
        streak = s.streak
      } catch { /* non-fatal */ }

      await sendDailyReminder(user.telegram_id, {
        username: user.username,
        challengeTitle: challenge.title,
        category: challenge.category ?? 'general',
        taskTitle: task.title,
        taskDesc: task.description,
        xpReward: task.xp_reward,
        dayNumber,
        totalDays: totalDays ?? dayNumber,
        streak,
      })

      totalSent++
      await sleep(40) // ~25 msg/sec
    }
  }

  console.log(`[cron/send-reminders] sent=${totalSent} skipped=${totalSkipped}`)
  res.status(200).json({ ok: true, sent: totalSent, skipped: totalSkipped })
}
