import { supabase } from './supabase'

export type LeaderboardScope = 'challenge' | 'community' | 'global'

export interface LeaderboardEntry {
  rank: number
  userId: number
  username: string
  xp: number
  isMe: boolean
}

export interface LeaderboardResult {
  scope: LeaderboardScope
  challengeId: number | null
  leaderboard: LeaderboardEntry[]
  me: { rank: number | null; userId: number; username: string; xp: number; isMe: true }
}

const LEADERBOARD_SIZE = 50

/**
 * Aggregates `xp_ledger` deltas by user for the given scope:
 * - `challenge`: only entries tied to a specific challenge (`ref_challenge = challengeId`)
 * - `community` / `global`: all entries (community is currently equivalent to global —
 *   reserved for future multi-community partitioning)
 */
export async function getLeaderboard(
  scope: LeaderboardScope,
  userId: number,
  challengeId?: number
): Promise<LeaderboardResult> {
  let query = supabase.from('xp_ledger').select('user_id, delta')

  if (scope === 'challenge') {
    if (!challengeId) throw new Error('challengeId is required for scope=challenge')
    query = query.eq('ref_challenge', challengeId)
  }

  const { data: entries, error } = await query
  if (error) throw error

  const totals = new Map<number, number>()
  for (const entry of entries ?? []) {
    totals.set(entry.user_id, (totals.get(entry.user_id) ?? 0) + entry.delta)
  }

  const ranked = Array.from(totals.entries())
    .map(([uid, xp]) => ({ userId: uid, xp }))
    .sort((a, b) => b.xp - a.xp)

  const top = ranked.slice(0, LEADERBOARD_SIZE)
  const userIds = top.map((r) => r.userId)
  if (!userIds.includes(userId)) userIds.push(userId)

  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, username, telegram_id')
    .in('id', userIds.length > 0 ? userIds : [-1])
  if (usersErr) throw usersErr

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  const leaderboard: LeaderboardEntry[] = top.map((r, idx) => ({
    rank: idx + 1,
    userId: r.userId,
    username: userMap.get(r.userId)?.username ?? `Player ${userMap.get(r.userId)?.telegram_id ?? r.userId}`,
    xp: r.xp,
    isMe: r.userId === userId,
  }))

  const myRankIdx = ranked.findIndex((r) => r.userId === userId)
  const me = {
    rank: myRankIdx >= 0 ? myRankIdx + 1 : null,
    userId,
    username: userMap.get(userId)?.username ?? `Player ${userMap.get(userId)?.telegram_id ?? userId}`,
    xp: myRankIdx >= 0 ? ranked[myRankIdx].xp : 0,
    isMe: true as const,
  }

  return { scope, challengeId: challengeId ?? null, leaderboard, me }
}
