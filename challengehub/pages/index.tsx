import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import ChallengeCard from '@/components/ui/ChallengeCard'
import Tabs from '@/components/ui/Tabs'
import XpBadge from '@/components/ui/XpBadge'
import { api, ChallengeDto, MeDto } from '@/lib/api-client'

type StatusFilter = 'active' | 'upcoming' | 'completed'

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [challenges, setChallenges] = useState<ChallengeDto[] | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('active')

  useEffect(() => {
    api.getMe().then(setMe).catch(() => setMe(null))
  }, [])

  useEffect(() => {
    setChallenges(null)
    api
      .getChallenges(filter)
      .then((data) => setChallenges(data.challenges))
      .catch(() => setChallenges([]))
  }, [filter])

  return (
    <>
      <Head>
        <title>ChallengeHub</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-wordmark">ChallengeHub 🏆</span>
          </div>
        </div>

        {me && (
          <div style={{ marginBottom: 18 }}>
            <XpBadge xp={me.xp} level={me.level} />
          </div>
        )}

        <Tabs
          tabs={[
            { key: 'active', label: 'Active' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'completed', label: 'Completed' },
          ]}
          active={filter}
          onChange={(k) => setFilter(k as StatusFilter)}
        />

        {challenges === null && (
          <>
            <div className="skeleton" style={{ height: 110, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 110, marginBottom: 12 }} />
          </>
        )}

        {challenges !== null && challenges.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">🗂️</div>
            No {filter} challenges right now — check back soon!
          </div>
        )}

        {challenges?.map((c, i) => <ChallengeCard key={c.id} challenge={c} delay={Math.min(i, 8) * 50} />)}
      </div>
      <BottomNav />
    </>
  )
}
