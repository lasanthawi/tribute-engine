import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import ChallengeCard from '@/components/ui/ChallengeCard'
import SpotlightCard from '@/components/ui/SpotlightCard'
import Tabs from '@/components/ui/Tabs'
import XpRing from '@/components/ui/XpRing'
import XpToast from '@/components/ui/XpToast'
import { TaskSubmitResult } from '@/components/ui/CheckinPanel'
import { api, ChallengeDto, MeDto, TaskDto } from '@/lib/api-client'

type StatusFilter = 'active' | 'upcoming' | 'completed'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [challenges, setChallenges] = useState<ChallengeDto[] | null>(null)
  const [allActive, setAllActive] = useState<ChallengeDto[] | null>(null)
  const [tasksByChallenge, setTasksByChallenge] = useState<Record<number, TaskDto[]>>({})
  const [rewardCount, setRewardCount] = useState<number | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('active')
  const [toast, setToast] = useState<TaskSubmitResult | null>(null)
  const [spotIndex, setSpotIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const loadMe = () => api.getMe().then(setMe).catch(() => setMe(null))
  const loadActive = () =>
    api
      .getChallenges('active')
      .then((data) => setAllActive(data.challenges))
      .catch(() => setAllActive([]))

  useEffect(() => {
    loadMe()
    loadActive()
    api
      .getRewards()
      .then((data) => setRewardCount(data.rewards.filter((r) => !r.claimed).length))
      .catch(() => setRewardCount(0))
  }, [])

  useEffect(() => {
    setChallenges(null)
    api
      .getChallenges(filter)
      .then((data) => setChallenges(data.challenges))
      .catch(() => setChallenges([]))
  }, [filter])

  const joinedActive = allActive?.filter((c) => c.isMember) ?? []

  useEffect(() => {
    if (joinedActive.length === 0) {
      setTasksByChallenge({})
      return
    }
    Promise.all(
      joinedActive.map((c) =>
        api
          .getChallengeTasks(c.id)
          .then((data) => [c.id, data.tasks] as const)
          .catch(() => [c.id, []] as const)
      )
    ).then((entries) => setTasksByChallenge(Object.fromEntries(entries)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActive])

  const spotlightChallenges = joinedActive.length > 0 ? joinedActive : allActive?.[0] ? [allActive[0]] : []
  const spotlightIds = new Set(spotlightChallenges.map((c) => c.id))
  const remainingChallenges = challenges?.filter((c) => !spotlightIds.has(c.id) || filter !== 'active')

  const handleSpotlightSubmitted = (result: TaskSubmitResult) => {
    setToast(result)
    loadMe()
    loadActive()
  }

  const handleCarouselScroll = () => {
    const el = carouselRef.current
    if (!el || el.clientWidth === 0) return
    setSpotIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  return (
    <>
      <Head>
        <title>ChallengeHub</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-icon">🏆</span>
            <span className="brand-wordmark">ChallengeHub</span>
          </div>
        </div>

        <div className="home-hero">
          <div className="home-hero-info">
            <div className="home-hero-greeting">
              {greeting()}{me?.username ? `, @${me.username}` : ''} 👋
            </div>
            <div className="home-hero-sub">
              {me ? `${me.xp.toLocaleString()} XP earned · keep the streak alive!` : 'Loading your progress…'}
            </div>
            {me && me.streak > 0 && (
              <div className={`streak-pill ${me.streakAtRisk ? 'at-risk' : ''}`}>
                <span className="streak-flame">🔥</span>
                {me.streak} day streak
                {me.streakAtRisk && <span className="streak-warning"> · check in today!</span>}
              </div>
            )}
          </div>
          {me && <XpRing xp={me.xp} level={me.level} />}
        </div>

        <div className="hero-stats">
          <div className="hero-stat-chip">
            <div className="hero-stat-chip-value">{me?.activeChallenges.length ?? '—'}</div>
            <div className="hero-stat-chip-label">Active</div>
          </div>
          <div className="hero-stat-chip">
            <div className="hero-stat-chip-value">{me?.xp.toLocaleString() ?? '—'}</div>
            <div className="hero-stat-chip-label">Total XP</div>
          </div>
          <div className="hero-stat-chip">
            <div className="hero-stat-chip-value">{rewardCount ?? '—'}</div>
            <div className="hero-stat-chip-label">Rewards</div>
          </div>
        </div>

        {spotlightChallenges.length > 0 && (
          <>
            <div className="spotlight-carousel" ref={carouselRef} onScroll={handleCarouselScroll}>
              {spotlightChallenges.map((c) => (
                <SpotlightCard
                  key={c.id}
                  challenge={c}
                  tasks={tasksByChallenge[c.id] ?? null}
                  onSubmitted={handleSpotlightSubmitted}
                />
              ))}
            </div>
            {spotlightChallenges.length > 1 && (
              <div className="spotlight-dots">
                {spotlightChallenges.map((_, i) => (
                  <span key={i} className={`spotlight-dot ${i === spotIndex ? 'active' : ''}`} />
                ))}
              </div>
            )}
          </>
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

        {remainingChallenges?.map((c, i) => <ChallengeCard key={c.id} challenge={c} delay={Math.min(i, 8) * 50} />)}
      </div>

      {toast && (
        <XpToast
          xp={toast.xpAwarded}
          leveledUp={toast.leveledUp}
          newLevel={toast.newLevel}
          isCatchup={toast.isCatchup}
          onDone={() => setToast(null)}
        />
      )}
      <BottomNav />
    </>
  )
}
