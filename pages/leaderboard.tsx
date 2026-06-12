import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import Logo from '@/components/ui/Logo'
import Tabs from '@/components/ui/Tabs'
import PointsCounter from '@/components/ui/PointsCounter'
import { api, LeaderboardDto } from '@/lib/api-client'

function rankClass(rank: number): string {
  if (rank === 1) return 'top1'
  if (rank === 2) return 'top2'
  if (rank === 3) return 'top3'
  return ''
}

const MEDALS: Record<number, string> = { 1: '👑', 2: '🥈', 3: '🥉' }

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
  const podium = data?.leaderboard.slice(0, 3) ?? []
  const rest = data?.leaderboard.slice(3) ?? []

  return (
    <>
      <Head>
        <title>League Standings · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot"><Logo size={26} /></span> League Standings
          </div>
        </div>

        <Tabs
          tabs={[
            { key: 'weekly', label: 'This Week' },
            { key: 'season', label: 'Season 0' },
          ]}
          active={period}
          onChange={(k) => setPeriod(k as 'weekly' | 'season')}
        />

        {data === null && (
          <>
            <div className="skeleton" style={{ height: 140, marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
          </>
        )}

        {data !== null && data.leaderboard.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">🏆</div>
            No points on the board yet — cast the first vote 🗳️
          </div>
        )}

        {podium.length > 0 && (
          <div className="podium">
            {podium.map((row) => (
              <div key={row.userId} className={`podium-spot rank-${row.rank} ${row.isMe ? 'me' : ''}`}>
                <div className="podium-medal">{MEDALS[row.rank]}</div>
                <div className="podium-avatar">{row.username.slice(0, 1).toUpperCase()}</div>
                <div className="podium-name">{row.username}{row.isMe ? ' (you)' : ''}</div>
                <div className="podium-points">
                  <PointsCounter value={row.points} />
                </div>
              </div>
            ))}
          </div>
        )}

        {rest.map((row, i) => (
          <div
            key={row.userId}
            className={`lb-row card-in ${row.isMe ? 'me' : ''}`}
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            <div className={`lb-rank ${rankClass(row.rank)}`}>{row.rank}</div>
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
