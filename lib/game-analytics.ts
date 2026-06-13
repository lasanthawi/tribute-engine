// VOTE LEAGUE — mini-game analytics (play volume + reward cost, used for catalog rotation)

import { supabase } from './supabase'

export interface GameStats {
  slug: string
  plays: number
  uniquePlayers: number
  totalPointsAwarded: number
  totalTicketsAwarded: number
  totalCoinsAwarded: number
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Play volume and reward cost for a single game slug over the trailing `sinceDays` days. */
export async function getGameStats(slug: string, sinceDays = 7, now = new Date()): Promise<GameStats> {
  const since = new Date(now)
  since.setUTCDate(since.getUTCDate() - sinceDays)

  const { data, error } = await supabase
    .from('minigame_plays')
    .select('user_id, reward_points, reward_tickets, reward_coins')
    .eq('game_slug', slug)
    .gte('played_date', toUtcDateString(since))
  if (error) throw error

  const rows = data ?? []
  const uniquePlayers = new Set(rows.map((r) => r.user_id)).size

  return {
    slug,
    plays: rows.length,
    uniquePlayers,
    totalPointsAwarded: rows.reduce((sum, r) => sum + r.reward_points, 0),
    totalTicketsAwarded: rows.reduce((sum, r) => sum + r.reward_tickets, 0),
    totalCoinsAwarded: rows.reduce((sum, r) => sum + r.reward_coins, 0),
  }
}

/** Stats for every given slug, in the same order. */
export async function getGameStatsForSlugs(slugs: string[], sinceDays = 7, now = new Date()): Promise<GameStats[]> {
  return Promise.all(slugs.map((slug) => getGameStats(slug, sinceDays, now)))
}

/**
 * Picks the worst-performing slug among `slugs` by unique-player count over
 * the trailing `sinceDays` days (ties broken by total plays). Returns null
 * if `slugs` is empty. Used to free a catalog slot before publishing a new game.
 */
export async function pickWorstPerformer(slugs: string[], sinceDays = 7, now = new Date()): Promise<string | null> {
  if (slugs.length === 0) return null
  const stats = await getGameStatsForSlugs(slugs, sinceDays, now)
  stats.sort((a, b) => a.uniquePlayers - b.uniquePlayers || a.plays - b.plays)
  return stats[0].slug
}
