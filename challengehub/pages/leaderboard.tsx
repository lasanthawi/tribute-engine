import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import Tabs from '@/components/ui/Tabs'
import LeaderboardRow from '@/components/ui/LeaderboardRow'
import LeaderboardPodium from '@/components/ui/LeaderboardPodium'
import { api, LeaderboardDto } from '@/lib/api-client'

export default function Leaderboard() {
  const [scope, setScope] = useState<'global' | 'community'>('global')
  const [data, setData] = useState<LeaderboardDto | null>(null)

  useEffect(() => {
    setData(null)
    api
      .getLeaderboard(scope)
      .then(setData)
      .catch(() =>
        setData({ scope, challengeId: null, leaderboard: [], me: { rank: 0, userId: 0, username: '', xp: 0, isMe: true } })
      )
  }, [scope])

  const meInTop = data?.leaderboard.some((r) => r.isMe)

  return (
    <>
      <Head>
        <title>Leaderboard · ChallengeHub</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">🏆 Leaderboard</div>
        </div>

        <Tabs
          tabs={[
            { key: 'global', label: 'Global' },
            { key: 'community', label: 'Community' },
          ]}
          active={scope}
          onChange={(k) => setScope(k as 'global' | 'community')}
        />

        {data === null && (
          <>
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 56, marginBottom: 8 }} />
          </>
        )}

        {data !== null && data.leaderboard.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">🏆</div>
            No XP earned yet — join a challenge and check in to get on the board!
          </div>
        )}

        {data && data.leaderboard.length >= 3 && <LeaderboardPodium rows={data.leaderboard.slice(0, 3)} />}

        {data?.leaderboard.slice(data.leaderboard.length >= 3 ? 3 : 0).map((row, i) => (
          <LeaderboardRow key={row.userId} row={row} delay={Math.min(i, 8) * 50} />
        ))}

        {data && !meInTop && data.me.rank !== null && (
          <div className="lb-sticky">
            <LeaderboardRow row={{ ...data.me, rank: data.me.rank as number }} />
          </div>
        )}
      </div>
      <BottomNav />
    </>
  )
}
