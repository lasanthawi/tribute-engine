import { LeaderboardEntryDto } from '@/lib/api-client'

function rankClass(rank: number): string {
  if (rank === 1) return 'top1'
  if (rank === 2) return 'top2'
  if (rank === 3) return 'top3'
  return ''
}

export default function LeaderboardRow({ row, delay = 0 }: { row: LeaderboardEntryDto; delay?: number }) {
  return (
    <div className={`lb-row card-in ${row.isMe ? 'me' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`lb-rank ${rankClass(row.rank)}`}>{row.rank}</div>
      <div className="lb-avatar">{row.username.slice(0, 1).toUpperCase()}</div>
      <div className="lb-name">
        {row.username}
        {row.isMe ? ' (you)' : ''}
      </div>
      <div className="lb-xp">{row.xp.toLocaleString()}</div>
    </div>
  )
}
