import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import { demoLeaderboard } from '@/lib/demo-data'

const LEADERBOARD_SIZE = 50

function startOfIsoWeekUtc(now: Date): Date {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7 // Monday = 1 ... Sunday = 7
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1))
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const period = req.query.period === 'weekly' ? 'weekly' : 'season'

  if (isDemoMode()) return res.status(200).json(demoLeaderboard(period))

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    let since: string
    if (period === 'weekly') {
      since = startOfIsoWeekUtc(new Date()).toISOString()
    } else {
      const { data: season, error: seasonErr } = await supabase
        .from('seasons')
        .select('starts_at')
        .eq('is_active', true)
        .limit(1)
        .single()
      if (seasonErr) throw seasonErr
      since = season.starts_at
    }

    const { data: entries, error } = await supabase
      .from('points_ledger')
      .select('user_id, delta')
      .gte('created_at', since)
    if (error) throw error

    const totals = new Map<number, number>()
    for (const entry of entries ?? []) {
      totals.set(entry.user_id, (totals.get(entry.user_id) ?? 0) + entry.delta)
    }

    const ranked = Array.from(totals.entries())
      .map(([uid, points]) => ({ userId: uid, points }))
      .sort((a, b) => b.points - a.points)

    const top = ranked.slice(0, LEADERBOARD_SIZE)
    const userIds = top.map((r) => r.userId)
    if (!userIds.includes(userId)) userIds.push(userId)

    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, telegram_id')
      .in('id', userIds)
    if (usersErr) throw usersErr

    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    const leaderboard = top.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      username: userMap.get(r.userId)?.username ?? `Player ${userMap.get(r.userId)?.telegram_id ?? r.userId}`,
      points: r.points,
      isMe: r.userId === userId,
    }))

    const myRankIdx = ranked.findIndex((r) => r.userId === userId)
    const me = {
      rank: myRankIdx >= 0 ? myRankIdx + 1 : null,
      userId,
      username: userMap.get(userId)?.username ?? `Player ${userMap.get(userId)?.telegram_id ?? userId}`,
      points: myRankIdx >= 0 ? ranked[myRankIdx].points : 0,
      isMe: true,
    }

    res.status(200).json({ period, leaderboard, me })
  } catch (error) {
    console.error('leaderboard error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
