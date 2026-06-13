import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import BottomNav from '@/components/ui/BottomNav'
import TapGame from '@/components/minigames/TapGame'
import SpinWheel from '@/components/minigames/SpinWheel'
import GomokuGame from '@/components/minigames/GomokuGame'
import { api, GameDto, GameId, TapPlayResultDto, SpinResultDto } from '@/lib/api-client'

export default function Games() {
  const router = useRouter()
  const [games, setGames] = useState<GameDto[] | null>(null)
  const [activeGame, setActiveGame] = useState<GameId | null>(null)
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
    setActiveGame('gomoku')
  }, [router.asPath, router.query.gomoku])

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
                  {g.id === 'gomoku'
                    ? 'Computer + live remote rooms'
                    : g.remainingPlays > 0
                    ? `${g.remainingPlays}/${g.maxPlaysPerDay} plays left today`
                    : 'Come back tomorrow'}
                </span>
                <button
                  className="game-play-btn"
                  disabled={g.id !== 'gomoku' && g.remainingPlays <= 0}
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

      {activeGame === 'gomoku' && (
        <GomokuGame
          initialJoinCode={gomokuJoinCode}
          onClose={() => {
            setActiveGame(null)
            setGomokuJoinCode(undefined)
          }}
        />
      )}

      <BottomNav />
    </>
  )
}
