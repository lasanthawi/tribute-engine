/** Simple level curve matching lib/xp.ts: level N requires N^2 * 100 cumulative XP. */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100
}

/** Returns progress (0-1) toward the next level, given current xp and level. */
export function levelProgress(xp: number, level: number): number {
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)
  return Math.min(1, Math.max(0, (xp - currentLevelXp) / span))
}
