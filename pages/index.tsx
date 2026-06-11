import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import AssetCard from '@/components/ui/AssetCard'
import PredictModal from '@/components/ui/PredictModal'
import PointsCounter from '@/components/ui/PointsCounter'
import { api, MeDto, RoundDto } from '@/lib/api-client'
import { haptic } from '@/lib/telegram-webapp'

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [rounds, setRounds] = useState<RoundDto[] | null>(null)
  const [modal, setModal] = useState<{ round: RoundDto; side: 'UP' | 'DOWN' } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    await api.predict(modal.round.id, side, confidence)
    setModal(null)
    await refresh()
  }

  const mainRounds = rounds?.filter((r) => r.kind === 'main_daily') ?? []
  const hourlyRounds = rounds?.filter((r) => r.kind === 'hourly') ?? []

  return (
    <>
      <Head>
        <title>CALLED IT</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot">🎯</span> CALLED IT
          </div>
        </div>

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
          <div className="stat-row" style={{ marginTop: 14 }}>
            <span className="pill pill-tickets">
              <span className="pill-icon">🎟️</span> {me?.tickets ?? '—'} tickets
            </span>
            <span className="pill pill-streak">
              <span className="pill-icon">🔥</span> {me?.streak ?? 0}d ·{' '}
              {me ? me.streakMultiplier.toFixed(1) : '1.0'}x
            </span>
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--down)', fontSize: 13, fontWeight: 600, marginTop: 12 }}>{error}</p>
        )}

        {rounds === null && (
          <>
            <div className="section-title">Loading rounds…</div>
            <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 140, marginBottom: 12 }} />
          </>
        )}

        {mainRounds.length > 0 && (
          <>
            <div className="section-title">⭐ Main Call</div>
            {mainRounds.map((r) => (
              <AssetCard key={r.id} round={r} onPredict={handlePredict} />
            ))}
          </>
        )}

        {hourlyRounds.length > 0 && (
          <>
            <div className="section-title">Hourly Calls</div>
            {hourlyRounds.map((r) => (
              <AssetCard key={r.id} round={r} onPredict={handlePredict} />
            ))}
          </>
        )}

        {rounds !== null && rounds.length === 0 && (
          <div className="empty-state">
            No rounds open right now.
            <br />
            New calls drop every hour — check back soon 🎯
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

      <BottomNav />
    </>
  )
}
