import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import { api, LeaderboardDto } from '@/lib/api-client'

function rankClass(rank: number): string {
  if (rank === 1) return 'top1'
  if (rank === 2) return 'top2'
  if (rank === 3) return 'top3'
  return ''
}

function medal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<'weekly' | 'season'>('weekly')
  const [data, setData] = useState<LeaderboardDto | null>(null)

  useEffect(() => {
    setData(null)
    api
      .getLeaderboard(period)
      .then(setData)
      .catch(() => setData({ period, leaderboard: [], me: { rank: null, userId: 0, username: '', points: 0, isMe: true } }))
  }, [period])

  const meInTop = data?.leaderboard.some((r) => r.isMe)

  return (
    <>
      <Head>
        <title>Leaderboard · CALLED IT</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot">🏆</span> Leaderboard
          </div>
        </div>

        <div className="tab-row">
          <button className={`tab-btn ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>
            This Week
          </button>
          <button className={`tab-btn ${period === 'season' ? 'active' : ''}`} onClick={() => setPeriod('season')}>
            Season 0
          </button>
        </div>

        {data === null && (
          <>
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
          </>
        )}

        {data !== null && data.leaderboard.length === 0 && (
          <div className="empty-state">No points on the board yet — be the first to call it 🎯</div>
        )}

        {data?.leaderboard.map((row) => (
          <div key={row.userId} className={`lb-row ${row.isMe ? 'me' : ''}`}>
            <div className={`lb-rank ${rankClass(row.rank)}`}>{medal(row.rank)}</div>
            <div className="lb-avatar">{row.username.slice(0, 1).toUpperCase()}</div>
            <div className="lb-name">{row.username}{row.isMe ? ' (you)' : ''}</div>
            <div className="lb-points">{row.points.toLocaleString()}</div>
          </div>
        ))}

        {data && !meInTop && data.me.rank !== null && (
          <div className="lb-sticky">
            <div className="lb-row me">
              <div className="lb-rank">{data.me.rank}</div>
              <div className="lb-avatar">{data.me.username.slice(0, 1).toUpperCase()}</div>
              <div className="lb-name">{data.me.username} (you)</div>
              <div className="lb-points">{data.me.points.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </>
  )
}
