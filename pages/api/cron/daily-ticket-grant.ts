import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { supabase } from '@/lib/supabase'

const FREE_TICKETS_PER_DAY = 5

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  try {
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    const { data: users, error: usersErr } = await supabase.from('users').select('id')
    if (usersErr) throw usersErr

    const { data: grantedToday, error: grantsErr } = await supabase
      .from('ticket_ledger')
      .select('user_id')
      .eq('reason', 'daily_grant')
      .gte('created_at', startOfDay.toISOString())
    if (grantsErr) throw grantsErr

    const grantedIds = new Set((grantedToday ?? []).map((g) => g.user_id))
    const toGrant = (users ?? []).filter((u) => !grantedIds.has(u.id))

    if (toGrant.length > 0) {
      const { error: insertErr } = await supabase.from('ticket_ledger').insert(
        toGrant.map((u) => ({ user_id: u.id, delta: FREE_TICKETS_PER_DAY, reason: 'daily_grant' as const }))
      )
      if (insertErr) throw insertErr
    }

    res.status(200).json({ ok: true, granted: toGrant.length })
  } catch (error) {
    console.error('daily-ticket-grant error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
