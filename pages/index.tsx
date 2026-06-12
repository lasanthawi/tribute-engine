import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import AssetCard from '@/components/ui/AssetCard'
import PredictModal from '@/components/ui/PredictModal'
import PointsCounter from '@/components/ui/PointsCounter'
import LeagueBadge from '@/components/ui/LeagueBadge'
import Confetti from '@/components/ui/Confetti'
import VoteConfirm from '@/components/ui/VoteConfirm'
import Logo from '@/components/ui/Logo'
import { api, MeDto, RoundDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [rounds, setRounds] = useState<RoundDto[] | null>(null)
  const [modal, setModal] = useState<{ round: RoundDto; side: 'UP' | 'DOWN' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [dailyBonus, setDailyBonus] = useState<number | null>(null)
  const [voteConfirm, setVoteConfirm] = useState<{ asset: 'BTC' | 'ETH' | 'TON'; side: 'UP' | 'DOWN' } | null>(null)

  const refresh = async () => {
    try {
      const [meData, roundsData] = await Promise.all([api.getMe(), api.getOpenRounds()])
      setMe(meData)
      setRounds(roundsData.rounds)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (me?.dailyBonusAwarded) {
      setDailyBonus(me.dailyBonusAmount)
      hapticNotify('success')
      setConfetti(true)
      const dismiss = setTimeout(() => setDailyBonus(null), 3200)
      const stopConfetti = setTimeout(() => setConfetti(false), 1600)
      return () => {
        clearTimeout(dismiss)
        clearTimeout(stopConfetti)
      }
    }
  }, [me?.dailyBonusAwarded, me?.dailyBonusAmount])

  const handlePredict = (round: RoundDto, side: 'UP' | 'DOWN') => {
    if (!me || me.tickets < 1) {
      haptic('heavy')
      setError('No tickets left — come back tomorrow for a free refill.')
      return
    }
    haptic('medium')
    setModal({ round, side })
  }

  const handleConfirm = async (side: 'UP' | 'DOWN', confidence: number) => {
    if (!modal) return
    const asset = modal.round.asset
    await api.predict(modal.round.id, side, confidence)
    hapticNotify('success')
    setModal(null)
    setVoteConfirm({ asset, side })
    await refresh()
  }

  const handleVoteConfirmDone = () => {
    setVoteConfirm(null)
    setConfetti(true)
    setTimeout(() => setConfetti(false), 1400)
  }

  const mainRounds = rounds?.filter((r) => r.kind === 'main_daily') ?? []
  const hourlyRounds = rounds?.filter((r) => r.kind === 'hourly') ?? []

  const isHot = (me?.streak ?? 0) >= 3

  return (
    <>
      <Head>
        <title>VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot"><Logo size={26} /></span>
            <span className="brand-wordmark">VOTE LEAGUE</span>
          </div>
        </div>

        {dailyBonus !== null && (
          <div className="daily-bonus-toast">
            <span className="daily-bonus-icon">🎁</span>
            <span>Daily login bonus — <b>+{dailyBonus} pts</b></span>
          </div>
        )}

        <div className="hero">
          <div className="hero-row">
            <div>
              <p className="hero-greeting">{me?.username ? `Welcome back, ${me.username}` : 'Welcome'}</p>
              <div className="hero-points">
                <span>{me ? <PointsCounter value={me.points} /> : '—'}</span>
                <span className="hero-points-label">points</span>
              </div>
            </div>
          </div>
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat-tile">
              <span className="stat-tile-icon">🎟️</span>
              <span className="stat-tile-value">{me?.tickets ?? '—'}</span>
              <span className="stat-tile-label">Tickets</span>
            </div>
            <div className={`stat-tile ${isHot ? 'hot' : ''}`}>
              <span className="stat-tile-icon">🔥</span>
              <span className="stat-tile-value">{me?.streak ?? 0}d</span>
              <span className="stat-tile-label">{me ? me.streakMultiplier.toFixed(1) : '1.0'}x boost</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-icon">📊</span>
              <span className="stat-tile-value">{rounds?.length ?? '—'}</span>
              <span className="stat-tile-label">Live markets</span>
            </div>
          </div>
          {me && (
            <div style={{ marginTop: 14 }}>
              <LeagueBadge points={me.points} />
            </div>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--down)', fontSize: 13, fontWeight: 600, marginTop: 12 }}>{error}</p>
        )}

        {rounds === null && (
          <>
            <div className="section-title">Loading votes…</div>
            <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
          </>
        )}

        {mainRounds.length > 0 && (
          <>
            <div className="section-title">⭐ Main Vote</div>
            {mainRounds.map((r, i) => (
              <div key={r.id} className="card-in" style={{ animationDelay: `${i * 70}ms` }}>
                <AssetCard round={r} onPredict={handlePredict} />
              </div>
            ))}
          </>
        )}

        {hourlyRounds.length > 0 && (
          <>
            <div className="section-title section-title-live">
              <span className="live-dot" /> Hourly Votes
            </div>
            {hourlyRounds.map((r, i) => (
              <div key={r.id} className="card-in" style={{ animationDelay: `${(mainRounds.length + i) * 70}ms` }}>
                <AssetCard round={r} onPredict={handlePredict} />
              </div>
            ))}
          </>
        )}

        {rounds !== null && rounds.length === 0 && (
          <div className="empty-state">
            No votes open right now.
            <br />
            New votes drop every hour — check back soon 🗳️
          </div>
        )}
      </div>

      {modal && (
        <PredictModal
          round={modal.round}
          initialSide={modal.side}
          maxStake={me?.points ?? 0}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}

      {voteConfirm && (
        <VoteConfirm asset={voteConfirm.asset} side={voteConfirm.side} onDone={handleVoteConfirmDone} />
      )}

      {confetti && <Confetti />}

      <BottomNav />
    </>
  )
}
