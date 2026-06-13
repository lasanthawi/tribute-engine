import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import { postWeeklyDigest } from '@/lib/marketing'

function startOfIsoWeekUtc(now: Date): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7 // Monday = 1 ... Sunday = 7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1))
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (isDemoMode()) return res.status(200).json({ ok: true, posted: false })

  try {
    const since = startOfIsoWeekUtc(new Date()).toISOString()

    const { data: entries, error } = await supabase.from('points_ledger').select('user_id, delta').gte('created_at', since)
    if (error) throw error

    const totals = new Map<number, number>()
    for (const entry of entries ?? []) {
      totals.set(entry.user_id, (totals.get(entry.user_id) ?? 0) + entry.delta)
    }

    const ranked = Array.from(totals.entries())
      .map(([userId, points]) => ({ userId, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)

    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, telegram_id')
      .in('id', ranked.length > 0 ? ranked.map((r) => r.userId) : [0])
    if (usersErr) throw usersErr
    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    const topUsers = ranked.map((r) => ({
      username: userMap.get(r.userId)?.username ?? `Player ${userMap.get(r.userId)?.telegram_id ?? r.userId}`,
      points: r.points,
    }))

    const { count: totalVotes, error: votesErr } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
    if (votesErr) throw votesErr

    await postWeeklyDigest(topUsers, totalVotes ?? 0)

    res.status(200).json({ ok: true, posted: true })
  } catch (error) {
    console.error('weekly-digest error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
