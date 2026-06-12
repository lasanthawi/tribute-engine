export interface LeagueTier {
  name: string
  icon: string
  minPoints: number
  color: string
}

export const LEAGUE_TIERS: LeagueTier[] = [
  { name: 'Rookie', icon: '🔰', minPoints: 0, color: '#9aa4bc' },
  { name: 'Bronze', icon: '🥉', minPoints: 1000, color: '#d59a6c' },
  { name: 'Silver', icon: '🥈', minPoints: 5000, color: '#d6dbe6' },
  { name: 'Gold', icon: '🥇', minPoints: 15000, color: '#ffd54a' },
  { name: 'Platinum', icon: '💎', minPoints: 40000, color: '#7ee8e8' },
  { name: 'Diamond', icon: '👑', minPoints: 100000, color: '#c9a6ff' },
]

export function getLeagueTier(points: number): LeagueTier {
  let tier = LEAGUE_TIERS[0]
  for (const t of LEAGUE_TIERS) {
    if (points >= t.minPoints) tier = t
  }
  return tier
}

export interface LeagueProgress {
  current: LeagueTier
  next: LeagueTier | null
  progress: number
  remaining: number
}

export function getLeagueProgress(points: number): LeagueProgress {
  const current = getLeagueTier(points)
  const idx = LEAGUE_TIERS.indexOf(current)
  const next = LEAGUE_TIERS[idx + 1] ?? null

  if (!next) return { current, next: null, progress: 1, remaining: 0 }

  const span = next.minPoints - current.minPoints
  const progress = Math.max(0, Math.min(1, (points - current.minPoints) / span))
  return { current, next, progress, remaining: next.minPoints - points }
}
