import { getLeagueProgress } from '@/lib/league'

export default function LeagueBadge({ points }: { points: number }) {
  const { current, next, progress, remaining } = getLeagueProgress(points)

  return (
    <div className="league-badge">
      <div className="league-badge-head">
        <span className="league-icon">{current.icon}</span>
        <span className="league-name" style={{ color: current.color }}>
          {current.name} League
        </span>
        {next && (
          <span className="league-next">
            {remaining.toLocaleString()} to {next.icon} {next.name}
          </span>
        )}
      </div>
      {next && (
        <div className="league-progress-track">
          <div
            className="league-progress-fill"
            style={{
              width: `${Math.max(4, progress * 100)}%`,
              background: `linear-gradient(90deg, ${current.color}, ${next.color})`,
            }}
          />
        </div>
      )}
    </div>
  )
}
