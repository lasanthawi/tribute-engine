import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import BottomNav from '@/components/ui/BottomNav'
import AssetCard from '@/components/ui/AssetCard'
import CoinIcon from '@/components/ui/CoinIcon'
import PredictModal from '@/components/ui/PredictModal'
import PointsCounter from '@/components/ui/PointsCounter'
import LeagueBadge from '@/components/ui/LeagueBadge'
import Confetti from '@/components/ui/Confetti'
import VoteConfirm from '@/components/ui/VoteConfirm'
import Logo from '@/components/ui/Logo'
import HeroPanel, { HeroPanelView } from '@/components/ui/HeroPanel'
import SentimentWidget from '@/components/ui/SentimentWidget'
import QuestCard from '@/components/ui/QuestCard'
import { api, CallDto, GameDto, MeDto, QuestDto, RoundDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

const PANEL_IDLE_MS = 3000
const ASSETS = ['BTC', 'ETH', 'TON'] as const
type AssetFilter = 'ALL' | (typeof ASSETS)[number]

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [rounds, setRounds] = useState<RoundDto[] | null>(null)
  const [modal, setModal] = useState<{ round: RoundDto; side: 'UP' | 'DOWN' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [dailyBonus, setDailyBonus] = useState<number | null>(null)
  const [voteConfirm, setVoteConfirm] = useState<{ asset: 'BTC' | 'ETH' | 'TON'; side: 'UP' | 'DOWN' } | null>(null)
  const [panelView, setPanelView] = useState<HeroPanelView>('countdown')
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('ALL')
  const [recentCalls, setRecentCalls] = useState<CallDto[] | null>(null)
  const [quests, setQuests] = useState<QuestDto[] | null>(null)
  const [games, setGames] = useState<GameDto[] | null>(null)
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = async () => {
    try {
      const [meData, roundsData] = await Promise.all([api.getMe(), api.getOpenRounds()])
      setMe(meData)
      setRounds(roundsData.rounds)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
    }
    try {
      const callsData = await api.getCalls()
      setRecentCalls(callsData.settled.slice(0, 5))
    } catch {
      setRecentCalls([])
    }
  }

  const refreshQuests = async () => {
    try {
      const data = await api.getQuests()
      setQuests(data.quests)
    } catch {
      setQuests([])
    }
  }

  const refreshGames = async () => {
    try {
      const data = await api.getGames()
      setGames(data.games)
    } catch {
      setGames([])
    }
  }

  useEffect(() => {
    refresh()
    refreshQuests()
    refreshGames()
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

  const showPanel = (view: HeroPanelView) => {
    haptic('light')
    setPanelView(view)
    if (panelTimer.current) clearTimeout(panelTimer.current)
    panelTimer.current = setTimeout(() => setPanelView('countdown'), PANEL_IDLE_MS)
  }

  useEffect(() => {
    return () => {
      if (panelTimer.current) clearTimeout(panelTimer.current)
    }
  }, [])

  const allRounds = rounds ?? []
  const filteredRounds = assetFilter === 'ALL' ? allRounds : allRounds.filter((r) => r.asset === assetFilter)
  const mainRounds = filteredRounds.filter((r) => r.kind === 'main_daily')
  const hourlyRounds = filteredRounds.filter((r) => r.kind === 'hourly')

  const trending = ASSETS.map((asset) => {
    const assetRounds = allRounds.filter((r) => r.asset === asset)
    const best = assetRounds.reduce<RoundDto | null>((acc, r) => {
      if (!acc || r.sentiment.total > acc.sentiment.total) return r
      return acc
    }, null)
    return { asset, round: best, count: assetRounds.length }
  }).filter((t) => t.round !== null) as { asset: (typeof ASSETS)[number]; round: RoundDto; count: number }[]

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
            <div className="hero-info">
              <Link href="/profile" className="hero-greeting-link">
                <span className="hero-greeting">{me?.username ? `Welcome back, ${me.username}` : 'Welcome'}</span>
                <span className="hero-greeting-arrow">›</span>
              </Link>
              <div className="hero-points">
                <span>{me ? <PointsCounter value={me.points} /> : '—'}</span>
                <span className="hero-points-label">points</span>
              </div>
            </div>
            <div className="hero-panel">
              <HeroPanel
                view={panelView}
                rounds={rounds}
                tickets={me?.tickets ?? null}
                streak={me?.streak ?? 0}
                streakMultiplier={me?.streakMultiplier ?? 1}
              />
            </div>
          </div>
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat-tile" role="button" tabIndex={0} onClick={() => showPanel('tickets')}>
              <span className="stat-tile-icon">🎟️</span>
              <span className="stat-tile-value">{me?.tickets ?? '—'}</span>
              <span className="stat-tile-label">Tickets</span>
            </div>
            <div
              className={`stat-tile ${isHot ? 'hot' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => showPanel('boost')}
            >
              <span className="stat-tile-icon">🔥</span>
              <span className="stat-tile-value">{me?.streak ?? 0}d</span>
              <span className="stat-tile-label">{me ? me.streakMultiplier.toFixed(1) : '1.0'}x boost</span>
            </div>
            <div className="stat-tile" role="button" tabIndex={0} onClick={() => showPanel('markets')}>
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

        {recentCalls !== null && recentCalls.length > 0 && (
          <Link href="/calls" className="activity-strip">
            <span className="activity-label">Recent results</span>
            <div className="activity-icons">
              {recentCalls.map((c) => {
                const cls = c.round.outcome === 'VOID' ? 'void' : c.isCorrect ? 'win' : 'loss'
                const icon = c.round.outcome === 'VOID' ? '⟳' : c.isCorrect ? '✅' : '❌'
                return (
                  <span key={c.id} className={`activity-icon ${cls}`}>
                    {icon}
                  </span>
                )
              })}
            </div>
            <span className="activity-arrow">My Votes →</span>
          </Link>
        )}

        <Link href="/invite" className="promo-banner">
          <span className="promo-icon">🎁</span>
          <span className="promo-text">
            <span className="promo-title">Invite friends, earn points</span>
            <span className="promo-sub">Get a 5% bonus on every point your friends earn</span>
          </span>
          <span className="promo-arrow">→</span>
        </Link>

        <SentimentWidget />

        {trending.length > 0 && (
          <>
            <div className="section-title">📈 Trending Markets</div>
            <div className="scroll-row">
              {trending.map(({ asset, round, count }) => {
                const { up, down, total } = round.sentiment
                const upPct = total > 0 ? Math.round((up / total) * 100) : 50
                return (
                  <div
                    key={asset}
                    className="trend-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      haptic('light')
                      setAssetFilter(asset)
                    }}
                  >
                    <div className="trend-card-head">
                      <CoinIcon asset={asset} size={22} />
                      <span className="trend-card-asset">{asset}</span>
                      {count > 1 && <span className="trend-card-count">{count} markets</span>}
                    </div>
                    <div className="trend-card-odds">
                      <span className="trend-card-up">▲ {upPct}%</span>
                      <span className="trend-card-down">{100 - upPct}% ▼</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {quests !== null && quests.length > 0 && (
          <>
            <div className="section-title">
              🎯 Quests
              <Link href="/quests" className="section-title-link">
                View all →
              </Link>
            </div>
            <div className="scroll-row">
              {quests.slice(0, 3).map((q) => (
                <div key={q.id} className="quest-teaser">
                  <QuestCard quest={q} compact onClaimed={refreshQuests} />
                </div>
              ))}
            </div>
          </>
        )}

        {games !== null && games.length > 0 && (
          <>
            <div className="section-title">
              🎮 Games
              <Link href="/games" className="section-title-link">
                Play →
              </Link>
            </div>
            <div className="scroll-row">
              {games.map((g) => (
                <Link key={g.slug} href="/games" className="game-teaser">
                  {g.coverImageUrl ? (
                    <span className="game-teaser-cover">
                      <img src={g.coverImageUrl} alt={g.title} />
                    </span>
                  ) : (
                    <span className="game-teaser-icon">{g.icon}</span>
                  )}
                  <span className="game-teaser-title">{g.title}</span>
                  <span className="game-teaser-sub">
                    {g.remainingPlays > 0
                      ? `${g.remainingPlays} play${g.remainingPlays === 1 ? '' : 's'} left`
                      : 'Come back tomorrow'}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {rounds !== null && rounds.length > 0 && (
          <div className="chip-row">
            {(['ALL', ...ASSETS] as AssetFilter[]).map((f) => {
              const count = f === 'ALL' ? allRounds.length : allRounds.filter((r) => r.asset === f).length
              return (
                <div
                  key={f}
                  className={`chip ${assetFilter === f ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    haptic('light')
                    setAssetFilter(f)
                  }}
                >
                  {f === 'ALL' ? '🌐 All' : f}
                  <span className="chip-count">{count}</span>
                </div>
              )
            })}
          </div>
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

        {rounds !== null && rounds.length > 0 && filteredRounds.length === 0 && (
          <div className="empty-state">
            No {assetFilter} votes open right now.
            <br />
            Try another asset or check back soon 🗳️
          </div>
        )}
      </div>

      {modal && (
        <PredictModal
          round={modal.round}
          initialSide={modal.side}
          maxStake={me?.points ?? 0}
          streakMultiplier={me?.streakMultiplier ?? 1}
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
