import Link from 'next/link'
import { ChallengeDto } from '@/lib/api-client'
import { getCategoryMeta } from '@/lib/categories'
import CategoryBadge from './CategoryBadge'

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ChallengeCard({ challenge, delay = 0 }: { challenge: ChallengeDto; delay?: number }) {
  const meta = getCategoryMeta(challenge.category)
  const borderClass = `cat-border-${meta.className.replace('cat-', '')}`

  return (
    <Link
      href={`/challenge/${challenge.id}`}
      className={`challenge-card ${borderClass} card-in`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="challenge-card-head">
        <div className="challenge-card-title-wrap">
          <CategoryBadge category={challenge.category} size={30} />
          <span className="challenge-card-title">{challenge.title}</span>
        </div>
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
