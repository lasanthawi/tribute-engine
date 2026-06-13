import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import { sendStreakReminder } from '@/lib/notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (isDemoMode()) return res.status(200).json({ ok: true, notified: 0 })

  try {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { data: users, error } = await supabase
      .from('users')
      .select('id, telegram_id, streak_count')
      .gt('streak_count', 0)
      .eq('notifications_enabled', true)
    if (error) throw error

    let notified = 0
    for (const user of users ?? []) {
      const { count, error: predErr } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
      if (predErr) throw predErr
      if ((count ?? 0) > 0) continue

      await sendStreakReminder(user.telegram_id, user.streak_count)
      notified++
    }

    res.status(200).json({ ok: true, notified })
  } catch (error) {
    console.error('streak-reminder error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
