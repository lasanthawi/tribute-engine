/** Simple level curve matching lib/xp.ts: level N requires N^2 * 100 cumulative XP. */
function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100
}

export default function XpBadge({ xp, level }: { xp: number; level: number }) {
  const currentLevelXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - currentLevelXp)
  const progress = Math.min(1, Math.max(0, (xp - currentLevelXp) / span))

  return (
    <div className="xp-badge-wrap">
      <div className="xp-badge">
        <span className="xp-badge-level">Lv {level}</span>
        <span className="xp-badge-value">{xp.toLocaleString()} XP</span>
      </div>
      <div className="xp-progress-track">
        <div className="xp-progress-fill" style={{ width: `${Math.max(4, progress * 100)}%` }} />
      </div>
    </div>
  )
}
