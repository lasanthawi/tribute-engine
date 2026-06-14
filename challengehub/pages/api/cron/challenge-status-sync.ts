import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { supabase } from '@/lib/supabase'

/**
 * Flips challenge status based on the current time vs start/end dates:
 * - upcoming -> active   (now >= start_date)
 * - active   -> completed (now >= end_date)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  try {
    const now = new Date().toISOString()

    const { data: toActivate, error: activateErr } = await supabase
      .from('challenges')
      .update({ status: 'active' })
      .eq('status', 'upcoming')
      .lte('start_date', now)
      .select('id')
    if (activateErr) throw activateErr

    const { data: toComplete, error: completeErr } = await supabase
      .from('challenges')
      .update({ status: 'completed' })
      .eq('status', 'active')
      .lte('end_date', now)
      .select('id')
    if (completeErr) throw completeErr

    res.status(200).json({
      ok: true,
      activated: (toActivate ?? []).map((c) => c.id),
      completed: (toComplete ?? []).map((c) => c.id),
    })
  } catch (error) {
    console.error('cron/challenge-status-sync error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
