import { useCallback, useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { SnakeConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

const CANVAS_SIZE = 320
const MIN_TICK_MS = 60

type Phase = 'ready' | 'countdown' | 'playing' | 'submitting' | 'done'
type Cell = [number, number]
type Dir = [number, number]

const UP: Dir = [-1, 0]
const DOWN: Dir = [1, 0]
const LEFT: Dir = [0, -1]
const RIGHT: Dir = [0, 1]

function sameCell(a: Cell, b: Cell) {
  return a[0] === b[0] && a[1] === b[1]
}

function isOpposite(a: Dir, b: Dir) {
  return a[0] === -b[0] && a[1] === -b[1]
}

interface FloatingText {
  id: number
  x: number
  y: number
  createdAt: number
  label: string
  color: string
}

export default function SnakeGame({
  slug,
  title,
  config,
  onComplete,
  onClose,
}: {
  slug: string
  title: string
  config: SnakeConfig
  onComplete: (result: PlayResultDto) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(config.durationSec)
  const [countdown, setCountdown] = useState(3)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snakeRef = useRef<Cell[]>([])
  const directionRef = useRef<Dir>(RIGHT)
  const pendingDirectionRef = useRef<Dir>(RIGHT)
  const foodRef = useRef<Cell>([0, 0])
  const obstaclesRef = useRef<Cell[]>([])
  const scoreRef = useRef(0)
  const floatingRef = useRef<FloatingText[]>([])
  const nextIdRef = useRef(0)
  const startedAtRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const tickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownStepRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overRef = useRef(false)

  const cellSize = CANVAS_SIZE / config.gridSize

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (tickTimeoutRef.current !== null) clearTimeout(tickTimeoutRef.current)
    tickTimeoutRef.current = null
    if (countdownRef.current !== null) clearInterval(countdownRef.current)
    countdownRef.current = null
    if (countdownStepRef.current !== null) clearTimeout(countdownStepRef.current)
    countdownStepRef.current = null
  }

  useEffect(() => stopLoop, [])

  const randomEmptyCell = (occupied: Cell[]): Cell => {
    const grid = config.gridSize
    for (let attempt = 0; attempt < 200; attempt++) {
      const cell: Cell = [Math.floor(Math.random() * grid), Math.floor(Math.random() * grid)]
      if (!occupied.some((c) => sameCell(c, cell))) return cell
    }
    return [0, 0]
  }

  const start = () => {
    const grid = config.gridSize
    const mid = Math.floor(grid / 2)
    const snake: Cell[] = [
      [mid, mid + 1],
      [mid, mid],
      [mid, mid - 1],
    ]
    snakeRef.current = snake
    directionRef.current = RIGHT
    pendingDirectionRef.current = RIGHT
    scoreRef.current = 0
    floatingRef.current = []
    overRef.current = false
    setScore(0)
    setTimeLeft(config.durationSec)

    const obstacleCount = config.obstacles ?? 0
    const obstacles: Cell[] = []
    for (let i = 0; i < obstacleCount; i++) {
      obstacles.push(randomEmptyCell([...snake, ...obstacles]))
    }
    obstaclesRef.current = obstacles
    foodRef.current = randomEmptyCell([...snake, ...obstacles])

    setPhase('countdown')
    setCountdown(3)

    const step = () => {
      if (overRef.current) return
      const grid = config.gridSize
      const dir = pendingDirectionRef.current
      if (!isOpposite(dir, directionRef.current) || snakeRef.current.length === 1) {
        directionRef.current = dir
      }
      const [dr, dc] = directionRef.current
      const head = snakeRef.current[0]
      let nr = head[0] + dr
      let nc = head[1] + dc

      if (config.wrap) {
        nr = (nr + grid) % grid
        nc = (nc + grid) % grid
      } else if (nr < 0 || nr >= grid || nc < 0 || nc >= grid) {
        return gameOver()
      }

      const newHead: Cell = [nr, nc]
      const ateFood = sameCell(newHead, foodRef.current)
      const body = ateFood ? snakeRef.current : snakeRef.current.slice(0, -1)

      if (body.some((c) => sameCell(c, newHead)) || obstaclesRef.current.some((c) => sameCell(c, newHead))) {
        return gameOver()
      }

      snakeRef.current = [newHead, ...body]

      if (ateFood) {
        scoreRef.current += 1
        setScore(scoreRef.current)
        haptic('light')
        floatingRef.current.push({
          id: nextIdRef.current++,
          x: (newHead[1] + 0.5) * cellSize,
          y: (newHead[0] + 0.5) * cellSize,
          createdAt: performance.now(),
          label: '+1',
          color: '#5be37a',
        })
        foodRef.current = randomEmptyCell([...snakeRef.current, ...obstaclesRef.current])
      }

      const elapsedSec = (performance.now() - startedAtRef.current) / 1000
      const ramp = config.speedRamp ?? 0
      const tickMs = Math.max(MIN_TICK_MS, config.tickMs * (1 - ramp * elapsedSec))
      tickTimeoutRef.current = setTimeout(step, tickMs)
    }

    const gameOver = () => {
      overRef.current = true
      hapticNotify('warning')
      stopLoop()
      submit()
    }

    const render = (now: number) => {
      draw(now)
      floatingRef.current = floatingRef.current.filter((f) => now - f.createdAt < 700)
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)

    const beginPlaying = () => {
      setPhase('playing')
      startedAtRef.current = performance.now()
      tickTimeoutRef.current = setTimeout(step, config.tickMs)
      countdownRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            overRef.current = true
            stopLoop()
            submit()
            return 0
          }
          return t - 1
        })
      }, 1000)
    }

    let ticksLeft = 3
    const tickCountdown = () => {
      ticksLeft -= 1
      if (ticksLeft <= 0) {
        setCountdown(0)
        beginPlaying()
        return
      }
      setCountdown(ticksLeft)
      countdownStepRef.current = setTimeout(tickCountdown, 700)
    }
    countdownStepRef.current = setTimeout(tickCountdown, 700)
  }

  const draw = (now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = config.theme.bg
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 1; i < config.gridSize; i++) {
      const pos = i * cellSize
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(CANVAS_SIZE, pos)
      ctx.stroke()
    }

    for (const [r, c] of obstaclesRef.current) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2)
    }

    const pulse = 0.7 + 0.3 * Math.sin(now / 180)
    const [fr, fc] = foodRef.current
    ctx.beginPath()
    ctx.fillStyle = config.theme.food
    ctx.shadowColor = config.theme.food
    ctx.shadowBlur = 12 * pulse
    ctx.arc((fc + 0.5) * cellSize, (fr + 0.5) * cellSize, (cellSize / 2) * 0.7 * pulse + cellSize * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    snakeRef.current.forEach(([r, c], i) => {
      const isHead = i === 0
      ctx.fillStyle = isHead ? '#ffffff' : config.theme.accent
      const inset = isHead ? 1 : 1.5
      const radius = isHead ? 6 : 4
      ctx.beginPath()
      const x = c * cellSize + inset
      const y = r * cellSize + inset
      const size = cellSize - inset * 2
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, size, size, radius)
      } else {
        ctx.rect(x, y, size, size)
      }
      ctx.fill()
    })

    for (const f of floatingRef.current) {
      const age = (now - f.createdAt) / 700
      ctx.globalAlpha = Math.max(0, 1 - age)
      ctx.fillStyle = f.color
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(f.label, f.x, f.y - age * 28)
      ctx.globalAlpha = 1
    }
  }

  const queueDirection = useCallback(
    (dir: Dir) => {
      if (phase !== 'playing' && phase !== 'countdown') return
      if (isOpposite(dir, directionRef.current) && snakeRef.current.length > 1) return
      pendingDirectionRef.current = dir
    },
    [phase]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') queueDirection(UP)
      else if (e.key === 'ArrowDown') queueDirection(DOWN)
      else if (e.key === 'ArrowLeft') queueDirection(LEFT)
      else if (e.key === 'ArrowRight') queueDirection(RIGHT)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queueDirection])

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return
    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? RIGHT : LEFT)
    } else {
      queueDirection(dy > 0 ? DOWN : UP)
    }
  }

  const submit = async () => {
    setPhase('submitting')
    try {
      const res = await api.playGame(slug, { score: scoreRef.current })
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
      <div className="sheet snake-sheet" style={{ '--snake-accent': config.theme.accent } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{title}</h3>

        {phase === 'ready' && (
          <>
            <p className="sheet-subtitle">
              Swipe or use the arrows to steer your snake for {config.durationSec} seconds. Eat the glowing orbs to
              grow and score — {config.wrap ? 'wrap around the edges' : "don't hit the walls"}, your tail, or the
              blocks! You&apos;ll get a 3-second head start before the snake moves.
            </p>
            <button className="btn-primary" onClick={start}>
              Start
            </button>
          </>
        )}

        {(phase === 'countdown' || phase === 'playing' || phase === 'submitting') && (
          <>
            <div className="tap-game-hud">
              <span className="snake-hud-stat">🟢 Score: {score}</span>
              <span className="snake-hud-stat">⏱ {timeLeft}s</span>
            </div>
            <div className="snake-canvas-wrap" style={{ background: config.theme.bg }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
              />
              {phase === 'countdown' && (
                <div className="snake-countdown">
                  <span className="snake-countdown-number" key={countdown}>
                    {countdown > 0 ? countdown : 'GO!'}
                  </span>
                  <span className="snake-countdown-hint">Get ready — steer with swipes or the arrows below</span>
                </div>
              )}
            </div>
            <div className="snake-controls">
              <div className="snake-controls-row">
                <button onClick={() => queueDirection(UP)} aria-label="Up">
                  ▲
                </button>
              </div>
              <div className="snake-controls-row">
                <button onClick={() => queueDirection(LEFT)} aria-label="Left">
                  ◀
                </button>
                <button onClick={() => queueDirection(DOWN)} aria-label="Down">
                  ▼
                </button>
                <button onClick={() => queueDirection(RIGHT)} aria-label="Right">
                  ▶
                </button>
              </div>
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
