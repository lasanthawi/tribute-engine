import { levelProgress } from '@/lib/xp-client'

export default function XpBadge({ xp, level }: { xp: number; level: number }) {
  const progress = levelProgress(xp, level)

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
