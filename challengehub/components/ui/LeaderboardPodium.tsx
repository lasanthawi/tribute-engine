import { LeaderboardEntryDto } from '@/lib/api-client'

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function PodiumItem({ row }: { row: LeaderboardEntryDto }) {
  return (
    <div className={`lb-podium-item rank${row.rank} ${row.isMe ? 'me' : ''}`}>
      <div className="lb-podium-medal">{MEDALS[row.rank]}</div>
      <div className="lb-podium-avatar">{row.username.slice(0, 1).toUpperCase()}</div>
      <div className="lb-podium-name">{row.username}</div>
      <div className="lb-podium-xp">{row.xp.toLocaleString()} XP</div>
    </div>
  )
}

/** Renders the top-3 leaderboard entries as a podium, reordered 2nd-1st-3rd. */
export default function LeaderboardPodium({ rows }: { rows: LeaderboardEntryDto[] }) {
  const first = rows.find((r) => r.rank === 1)
  const second = rows.find((r) => r.rank === 2)
  const third = rows.find((r) => r.rank === 3)

  return (
    <div className="lb-podium">
      {second && <PodiumItem row={second} />}
      {first && <PodiumItem row={first} />}
      {third && <PodiumItem row={third} />}
    </div>
  )
}
