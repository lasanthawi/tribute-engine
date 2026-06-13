import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import TapGame from '@/components/minigames/TapGame'
import SpinWheel from '@/components/minigames/SpinWheel'
import { api, GameDto, TapPlayResultDto, SpinResultDto } from '@/lib/api-client'

export default function Games() {
  const [games, setGames] = useState<GameDto[] | null>(null)
  const [activeGame, setActiveGame] = useState<'tap' | 'spin' | null>(null)

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

  const spinGame = (games ?? []).find((g) => g.id === 'spin')

  const handleTapComplete = (_result: TapPlayResultDto) => {
    refresh()
  }

  const handleSpinComplete = (_result: SpinResultDto) => {
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
            <div key={g.id} className="game-card">
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
                  onClick={() => setActiveGame(g.id)}
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

      {activeGame === 'tap' && (
        <TapGame onComplete={handleTapComplete} onClose={() => setActiveGame(null)} />
      )}

      {activeGame === 'spin' && (
        <div className="sheet-backdrop" onClick={() => setActiveGame(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">🎡 Daily Spin</h3>
            <SpinWheel remainingPlays={spinGame?.remainingPlays ?? 0} onComplete={handleSpinComplete} />
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setActiveGame(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  )
}
