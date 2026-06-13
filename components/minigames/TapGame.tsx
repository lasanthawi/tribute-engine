import { useEffect, useRef, useState } from 'react'
import { api, TapPlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import Confetti from '@/components/ui/Confetti'

const DURATION_SEC = 30
const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 360
const SPAWN_MIN_MS = 600
const SPAWN_MAX_MS = 900

const COIN_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  TON: '#0098EA',
}
const COIN_LABELS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  TON: '◆',
}
const ASSETS = ['BTC', 'ETH', 'TON'] as const

interface Coin {
  id: number
  x: number
  y: number
  vy: number
  size: number
  asset: (typeof ASSETS)[number]
}

interface FloatingText {
  id: number
  x: number
  y: number
  createdAt: number
}

type Phase = 'ready' | 'playing' | 'submitting' | 'done'

export default function TapGame({
  onComplete,
  onClose,
}: {
  onComplete: (result: TapPlayResultDto) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC)
  const [result, setResult] = useState<TapPlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const coinsRef = useRef<Coin[]>([])
  const floatingRef = useRef<FloatingText[]>([])
  const scoreRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const nextSpawnRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextIdRef = useRef(0)

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (intervalRef.current !== null) clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  useEffect(() => stopLoop, [])

  const start = () => {
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(DURATION_SEC)
    coinsRef.current = []
    floatingRef.current = []
    nextSpawnRef.current = 0
    setPhase('playing')

    let last = performance.now()

    const loop = (now: number) => {
      const dt = now - last
      last = now

      nextSpawnRef.current -= dt
      if (nextSpawnRef.current <= 0) {
        const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)]
        const size = 24 + Math.random() * 10
        coinsRef.current.push({
          id: nextIdRef.current++,
          x: size + Math.random() * (CANVAS_WIDTH - size * 2),
          y: -size,
          vy: (2 + Math.random() * 2) * (dt / 16.67 || 1),
          size,
          asset,
        })
        nextSpawnRef.current = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS)
      }

      coinsRef.current = coinsRef.current
        .map((c) => ({ ...c, y: c.y + c.vy }))
        .filter((c) => c.y < CANVAS_HEIGHT + c.size)

      floatingRef.current = floatingRef.current.filter((f) => now - f.createdAt < 700)

      render(now)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopLoop()
          submit()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const render = (now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    for (const coin of coinsRef.current) {
      ctx.beginPath()
      ctx.arc(coin.x, coin.y, coin.size, 0, Math.PI * 2)
      ctx.fillStyle = COIN_COLORS[coin.asset]
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `${Math.round(coin.size)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(COIN_LABELS[coin.asset], coin.x, coin.y + 1)
    }

    for (const f of floatingRef.current) {
      const age = (now - f.createdAt) / 700
      ctx.globalAlpha = Math.max(0, 1 - age)
      ctx.fillStyle = '#5be37a'
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('+1', f.x, f.y - age * 30)
      ctx.globalAlpha = 1
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT

    const hitIndex = coinsRef.current.findIndex((c) => {
      const dx = c.x - x
      const dy = c.y - y
      return Math.sqrt(dx * dx + dy * dy) <= c.size
    })

    if (hitIndex >= 0) {
      const coin = coinsRef.current[hitIndex]
      coinsRef.current = coinsRef.current.filter((_, i) => i !== hitIndex)
      floatingRef.current.push({ id: nextIdRef.current++, x: coin.x, y: coin.y, createdAt: performance.now() })
      scoreRef.current += 1
      setScore(scoreRef.current)
      haptic('light')
    }
  }

  const submit = async () => {
    setPhase('submitting')
    try {
      const res = await api.playTapGame(scoreRef.current)
      setResult(res)
      hapticNotify('success')
      setPhase('done')
      onComplete(res)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      hapticNotify('error')
      setPhase('done')
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">🪙 Coin Catcher</h3>

        {phase === 'ready' && (
          <>
            <p className="sheet-subtitle">Tap the falling coins for 30 seconds. Earn points based on your score!</p>
            <button className="btn-primary" onClick={start}>
              Start
            </button>
          </>
        )}

        {(phase === 'playing' || phase === 'submitting') && (
          <>
            <div className="tap-game-hud">
              <span>Score: {score}</span>
              <span>⏱ {timeLeft}s</span>
            </div>
            <div className="tap-game-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
              />
            </div>
          </>
        )}

        {phase === 'done' && (
          <div className="tap-game-result">
            {error ? (
              <p style={{ color: 'var(--down)', fontWeight: 600 }}>{error}</p>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700 }}>Score: {score}</p>
                <p style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>+{result?.rewardPoints ?? 0} pts</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                  {result && result.remainingPlays > 0 ? `${result.remainingPlays} plays left today` : 'Come back tomorrow'}
                </p>
              </>
            )}
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
      {phase === 'done' && !error && (result?.rewardPoints ?? 0) >= 30 && <Confetti />}
    </div>
  )
}
