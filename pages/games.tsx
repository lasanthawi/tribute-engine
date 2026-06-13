import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import TapGame from '@/components/minigames/TapGame'
import SpinWheel from '@/components/minigames/SpinWheel'
import { api, GameDto, PlayResultDto } from '@/lib/api-client'
import { TapCatchConfig, SpinWheelConfig } from '@/lib/game-templates'

export default function Games() {
  const [games, setGames] = useState<GameDto[] | null>(null)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

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

  const activeGame = (games ?? []).find((g) => g.slug === activeSlug)

  const handleComplete = (_result: PlayResultDto) => {
    refresh()
  }

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

        {games === null && (
          <>
            <div className="skeleton" style={{ height: 110, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 110, marginBottom: 12 }} />
          </>
        )}

        {games !== null &&
          games.map((g) => (
            <div key={g.slug} className="game-card">
              {g.coverImageUrl && (
                <div className="game-card-cover">
                  <img src={g.coverImageUrl} alt={g.title} />
                </div>
              )}
              <div className="game-card-head">
                <span className="game-card-icon">{g.icon}</span>
                <div>
                  <div className="game-card-title">{g.title}</div>
                  <div className="game-card-desc">{g.description}</div>
                </div>
              </div>
              <div className="game-card-footer">
                <span className="game-card-plays">
                  {g.remainingPlays > 0
                    ? `${g.remainingPlays}/${g.maxPlaysPerDay} plays left today`
                    : 'Come back tomorrow'}
                </span>
                <button
                  className="game-play-btn"
                  disabled={g.remainingPlays <= 0}
                  onClick={() => setActiveSlug(g.slug)}
                >
                  Play
                </button>
              </div>
            </div>
          ))}

        {games !== null && games.length === 0 && (
          <div className="empty-state">No games available right now.</div>
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

      <BottomNav />
    </>
  )
}
