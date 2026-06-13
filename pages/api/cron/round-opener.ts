import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { openDueRounds } from '@/lib/rounds'
import { broadcastMainRoundsOpen } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (isDemoMode()) return res.status(200).json({ ok: true, opened: 0, notified: 0 })

  try {
    const { opened, openedMainDaily } = await openDueRounds()

    let notified = 0
    if (openedMainDaily.length > 0) {
      const assets = Array.from(new Set(openedMainDaily.map((r) => r.asset)))
      const { data: users, error } = await supabase
        .from('users')
        .select('telegram_id')
        .eq('notifications_enabled', true)
      if (error) throw error
      const telegramIds = (users ?? []).map((u) => u.telegram_id)
      notified = await broadcastMainRoundsOpen(telegramIds, assets)
    }

    res.status(200).json({ ok: true, opened, notified })
  } catch (error) {
    console.error('round-opener error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
