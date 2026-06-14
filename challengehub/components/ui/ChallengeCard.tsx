import Link from 'next/link'
import { ChallengeDto } from '@/lib/api-client'

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ChallengeCard({ challenge, delay = 0 }: { challenge: ChallengeDto; delay?: number }) {
  return (
    <Link
      href={`/challenge/${challenge.id}`}
      className="challenge-card card-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="challenge-card-head">
        <span className="challenge-card-title">{challenge.title}</span>
        <span className={`challenge-status ${challenge.status}`}>{challenge.status}</span>
      </div>
      <p className="challenge-card-desc">{challenge.description}</p>
      <div className="challenge-card-footer">
        <span>{formatDateRange(challenge.startDate, challenge.endDate)}</span>
        <span>
          {challenge.memberCount ?? 0} joined
          {challenge.isMember && <span className="challenge-card-member"> · You're in</span>}
        </span>
      </div>
    </Link>
  )
}
