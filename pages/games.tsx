import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import BottomNav from '@/components/ui/BottomNav'
import TapGame from '@/components/minigames/TapGame'
import SpinWheel from '@/components/minigames/SpinWheel'
import GomokuGame from '@/components/minigames/GomokuGame'
import SnakeGame from '@/components/minigames/SnakeGame'
import { api, GameDto, PlayResultDto } from '@/lib/api-client'
import { TapCatchConfig, SpinWheelConfig, SnakeConfig } from '@/lib/game-templates'

const CATEGORY_LABEL: Record<string, string> = {
  tap_catch: 'Arcade',
  snake_run: 'Arcade',
  spin_wheel: 'Lucky Draw',
  gomoku: 'Multiplayer',
}

function maxReward(g: GameDto): number {
  if (g.template === 'tap_catch' || g.template === 'snake_run') {
    const cfg = g.config as TapCatchConfig | SnakeConfig
    return cfg.rewardCurve.reduce((max, tier) => Math.max(max, tier.points), 0)
  }
  if (g.template === 'spin_wheel') {
    const cfg = g.config as SpinWheelConfig
    return cfg.segments.reduce((max, s) => Math.max(max, s.rewardPoints), 0)
  }
  return 0
}

function playsLabel(g: GameDto): string {
  return g.remainingPlays > 0
    ? `${g.remainingPlays}/${g.maxPlaysPerDay} left today`
    : 'Come back tomorrow'
}

export default function Games() {
  const router = useRouter()
  const [games, setGames] = useState<GameDto[] | null>(null)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [gomokuJoinCode, setGomokuJoinCode] = useState<string | undefined>()

  const refresh = async () => {
    try {
      const data = await api.getGames()
      setGames(data.games)
    } catch {
      setGames([])
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const code =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('gomoku')?.trim().toUpperCase() ?? ''
        : typeof router.query.gomoku === 'string'
        ? router.query.gomoku.trim().toUpperCase()
        : ''
    if (!code) return
    setGomokuJoinCode(code)
    setActiveSlug('gomoku')
  }, [router.asPath, router.query.gomoku])

  const activeGame = (games ?? []).find((g) => g.slug === activeSlug)

  const handleComplete = (_result: PlayResultDto) => {
    refresh()
  }

  const arcadeGames = (games ?? []).filter((g) => g.template === 'tap_catch' || g.template === 'snake_run')
  const spinGame = (games ?? []).find((g) => g.template === 'spin_wheel')
  const gomokuGame = (games ?? []).find((g) => g.template === 'gomoku')

  const playsLeftToday = (games ?? [])
    .filter((g) => g.template !== 'gomoku')
    .reduce((sum, g) => sum + g.remainingPlays, 0)
  const topReward = (games ?? []).reduce((max, g) => Math.max(max, maxReward(g)), 0)

  return (
    <>
      <Head>
        <title>Games · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-wordmark">🎮 Games</span>
          </div>
        </div>

        <div className="games-hero">
          <div className="games-hero-title">Mini-Games Arcade</div>
          <div className="games-hero-sub">Play daily for bonus points, coins, and tickets</div>
          <div className="games-stats-row">
            <div className="games-stat-chip">
              <div className="games-stat-value">{games === null ? '–' : games.length}</div>
              <div className="games-stat-label">Games</div>
            </div>
            <div className="games-stat-chip">
              <div className="games-stat-value">{games === null ? '–' : playsLeftToday}</div>
              <div className="games-stat-label">Plays Left</div>
            </div>
            <div className="games-stat-chip">
              <div className="games-stat-value">{games === null ? '–' : `${topReward}`}</div>
              <div className="games-stat-label">Top Reward</div>
            </div>
          </div>
        </div>

        {games === null && (
          <>
            <div className="skeleton" style={{ height: 160, marginBottom: 18 }} />
            <div className="skeleton" style={{ height: 200, marginBottom: 18 }} />
            <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
          </>
        )}

        {games !== null && games.length === 0 && (
          <div className="empty-state">No games available right now.</div>
        )}

        {games !== null && games.length > 0 && (
          <>
            {(gomokuGame || spinGame) && (
              <div className="games-section">
                <div className="games-section-title">🔥 Featured</div>
                <div className="scroll-row">
                  {gomokuGame && (
                    <div className="game-feature-card" onClick={() => setActiveSlug(gomokuGame.slug)}>
                      {gomokuGame.coverImageUrl && (
                        <div className="game-feature-cover">
                          <img src={gomokuGame.coverImageUrl} alt={gomokuGame.title} />
                          <span className="game-feature-badge">{CATEGORY_LABEL[gomokuGame.template]}</span>
                        </div>
                      )}
                      <div className="game-feature-body">
                        <div className="game-feature-title">
                          <span>{gomokuGame.icon}</span>
                          {gomokuGame.title}
                        </div>
                        <div className="game-feature-desc">{gomokuGame.description}</div>
                        <div className="game-feature-footer">
                          <span className="game-card-plays">Computer + live remote rooms</span>
                          <button className="game-play-btn" onClick={(e) => { e.stopPropagation(); setActiveSlug(gomokuGame.slug) }}>
                            Play
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {spinGame && (
                    <div className="game-feature-card" onClick={() => setActiveSlug(spinGame.slug)}>
                      {spinGame.coverImageUrl && (
                        <div className="game-feature-cover">
                          <img src={spinGame.coverImageUrl} alt={spinGame.title} />
                          <span className="game-feature-badge">{CATEGORY_LABEL[spinGame.template]}</span>
                        </div>
                      )}
                      <div className="game-feature-body">
                        <div className="game-feature-title">
                          <span>{spinGame.icon}</span>
                          {spinGame.title}
                        </div>
                        <div className="game-feature-desc">{spinGame.description}</div>
                        <div className="game-feature-footer">
                          <span className="game-card-plays">{playsLabel(spinGame)}</span>
                          <button
                            className="game-play-btn"
                            disabled={spinGame.remainingPlays <= 0}
                            onClick={(e) => { e.stopPropagation(); setActiveSlug(spinGame.slug) }}
                          >
                            Spin
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {arcadeGames.length > 0 && (
              <div className="games-section">
                <div className="games-section-title">
                  🕹️ Arcade Zone <span className="games-section-sub">tap, dodge, score</span>
                </div>
                <div className="games-grid">
                  {arcadeGames.map((g) => (
                    <div key={g.slug} className="game-grid-card">
                      {g.coverImageUrl && (
                        <div className="game-grid-cover">
                          <img src={g.coverImageUrl} alt={g.title} />
                        </div>
                      )}
                      <div className="game-grid-body">
                        <div className="game-grid-title">
                          <span>{g.icon}</span>
                          {g.title}
                        </div>
                        <div className="game-grid-desc">{g.description}</div>
                        <div className="game-grid-footer">
                          <span className="game-grid-plays">{playsLabel(g)}</span>
                          <button
                            className="game-play-btn"
                            disabled={g.remainingPlays <= 0}
                            onClick={() => setActiveSlug(g.slug)}
                          >
                            Play
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {activeGame && activeGame.template === 'tap_catch' && (
        <TapGame
          slug={activeGame.slug}
          title={`${activeGame.icon} ${activeGame.title}`}
          config={activeGame.config as TapCatchConfig}
          onComplete={handleComplete}
          onClose={() => setActiveSlug(null)}
        />
      )}

      {activeGame && activeGame.template === 'snake_run' && (
        <SnakeGame
          slug={activeGame.slug}
          title={`${activeGame.icon} ${activeGame.title}`}
          config={activeGame.config as SnakeConfig}
          onComplete={handleComplete}
          onClose={() => setActiveSlug(null)}
        />
      )}

      {activeGame && activeGame.template === 'spin_wheel' && (
        <div className="sheet-backdrop" onClick={() => setActiveSlug(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">{activeGame.icon} {activeGame.title}</h3>
            <SpinWheel
              slug={activeGame.slug}
              config={activeGame.config as SpinWheelConfig}
              remainingPlays={activeGame.remainingPlays}
              onComplete={handleComplete}
            />
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveSlug(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {activeGame && activeGame.template === 'gomoku' && (
        <GomokuGame
          initialJoinCode={gomokuJoinCode}
          onClose={() => {
            setActiveSlug(null)
            setGomokuJoinCode(undefined)
          }}
        />
      )}

      <BottomNav />
    </>
  )
}
