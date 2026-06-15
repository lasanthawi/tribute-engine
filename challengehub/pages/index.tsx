import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import BottomNav from '@/components/ui/BottomNav'
import ChallengeCard from '@/components/ui/ChallengeCard'
import Tabs from '@/components/ui/Tabs'
import XpRing from '@/components/ui/XpRing'
import { getCategoryMeta } from '@/lib/categories'
import { api, ChallengeDto, MeDto } from '@/lib/api-client'

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
  const [rewardCount, setRewardCount] = useState<number | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('active')

  useEffect(() => {
    api.getMe().then(setMe).catch(() => setMe(null))
    api
      .getChallenges('active')
      .then((data) => setAllActive(data.challenges))
      .catch(() => setAllActive([]))
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

  const spotlight = allActive?.find((c) => c.isMember) ?? allActive?.[0] ?? null
  const spotlightMeta = getCategoryMeta(spotlight?.category)
  const spotlightCatClass = `cat-${spotlightMeta.className.replace('cat-', '')}`
  const remainingChallenges = challenges?.filter((c) => c.id !== spotlight?.id || filter !== 'active')

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

        <div className="home-hero">
          <div className="home-hero-info">
            <div className="home-hero-greeting">
              {greeting()}{me?.username ? `, @${me.username}` : ''} 👋
            </div>
            <div className="home-hero-sub">
              {me ? `${me.xp.toLocaleString()} XP earned · keep the streak alive!` : 'Loading your progress…'}
            </div>
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

        {spotlight && (
          <Link href={`/challenge/${spotlight.id}`} className={`spotlight-card ${spotlightCatClass}`}>
            <div className="spotlight-eyebrow">{spotlight.isMember ? 'Continue your challenge' : 'Featured challenge'}</div>
            <div className="spotlight-icon">{spotlightMeta.icon}</div>
            <h2 className="spotlight-title">{spotlight.title}</h2>
            <p className="spotlight-desc">{spotlight.description}</p>
            <span className="spotlight-cta">{spotlight.isMember ? 'Continue →' : 'Join now →'}</span>
          </Link>
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
      <BottomNav />
    </>
  )
}
