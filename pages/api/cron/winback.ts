import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import { adjustTickets } from '@/lib/ledger'
import { sendWinBackNudge } from '@/lib/marketing'

const WINBACK_INACTIVE_DAYS = 3
const WINBACK_COOLDOWN_DAYS = 7

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (isDemoMode()) return res.status(200).json({ ok: true, notified: 0 })

  try {
    const now = new Date()
    const inactiveSince = new Date(now.getTime() - WINBACK_INACTIVE_DAYS * 24 * 60 * 60 * 1000)
    const cooldownSince = new Date(now.getTime() - WINBACK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)

    const { data: users, error } = await supabase
      .from('users')
      .select('id, telegram_id')
      .eq('notifications_enabled', true)
      .lte('last_seen_at', inactiveSince.toISOString())
    if (error) throw error

    let notified = 0
    for (const user of users ?? []) {
      const { count, error: ticketErr } = await supabase
        .from('ticket_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('reason', 'winback_bonus')
        .gte('created_at', cooldownSince.toISOString())
      if (ticketErr) throw ticketErr
      if ((count ?? 0) > 0) continue

      await adjustTickets(user.id, 1, 'winback_bonus')
      await sendWinBackNudge(user.telegram_id)
      notified++
    }

    res.status(200).json({ ok: true, notified })
  } catch (error) {
    console.error('winback error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
