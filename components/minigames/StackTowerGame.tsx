import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { StackTowerConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

const CANVAS_HEIGHT = 420
const ACTIVE_ROW_Y = 90
const MIN_OVERLAP = 4

type Phase = 'ready' | 'playing' | 'submitting' | 'done'

interface Block {
  x: number
  width: number
  color: string
}

interface ActiveBlock extends Block {
  dir: 1 | -1
}

interface FloatingText {
  id: number
  x: number
  y: number
  createdAt: number
  label: string
  color: string
}

export default function StackTowerGame({
  slug,
  title,
  config,
  onComplete,
  onClose,
}: {
  slug: string
  title: string
  config: StackTowerConfig
  onComplete: (result: PlayResultDto) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stackRef = useRef<Block[]>([])
  const activeRef = useRef<ActiveBlock>({ x: 0, width: config.blockWidth, color: config.theme.accent, dir: 1 })
  const scoreRef = useRef(0)
  const floatingRef = useRef<FloatingText[]>([])
  const nextIdRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const overRef = useRef(false)

  const boardWidth = config.boardWidth
  const blockHeight = config.blockHeight

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  useEffect(() => stopLoop, [])

  const colorForRow = (row: number) => config.theme.blockColors[row % config.theme.blockColors.length]

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

  const gameOver = () => {
    overRef.current = true
    hapticNotify('warning')
    stopLoop()
    submit()
  }

  const start = () => {
    stackRef.current = [{ x: 0, width: boardWidth, color: config.theme.accent }]
    activeRef.current = { x: 0, width: config.blockWidth, color: colorForRow(1), dir: 1 }
    scoreRef.current = 0
    floatingRef.current = []
    overRef.current = false
    setScore(0)
    setPhase('playing')
    lastTimeRef.current = performance.now()

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now
      if (!overRef.current) {
        const speed = config.blockSpeed * (1 + (config.speedRamp ?? 0) * scoreRef.current)
        const active = activeRef.current
        const maxX = boardWidth - active.width
        active.x += active.dir * speed * dt
        if (active.x <= 0) {
          active.x = 0
          active.dir = 1
        } else if (active.x >= maxX) {
          active.x = Math.max(0, maxX)
          active.dir = -1
        }
      }
      draw(now)
      floatingRef.current = floatingRef.current.filter((f) => now - f.createdAt < 700)
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
  }

  const drop = () => {
    if (phase !== 'playing' || overRef.current) return
    const active = activeRef.current
    const prev = stackRef.current[stackRef.current.length - 1]
    const overlapStart = Math.max(active.x, prev.x)
    const overlapEnd = Math.min(active.x + active.width, prev.x + prev.width)
    const overlapWidth = overlapEnd - overlapStart

    if (overlapWidth < MIN_OVERLAP) {
      return gameOver()
    }

    const isPerfect =
      !!config.perfectBonus && Math.abs(overlapWidth - prev.width) < MIN_OVERLAP && Math.abs(overlapStart - prev.x) < MIN_OVERLAP
    const newWidth = isPerfect ? prev.width : overlapWidth
    const newX = isPerfect ? prev.x : overlapStart

    const placedRow = stackRef.current.length
    stackRef.current.push({ x: newX, width: newWidth, color: colorForRow(placedRow) })
    scoreRef.current += 1
    setScore(scoreRef.current)
    haptic('light')

    floatingRef.current.push({
      id: nextIdRef.current++,
      x: newX + newWidth / 2,
      y: ACTIVE_ROW_Y,
      createdAt: performance.now(),
      label: isPerfect ? 'PERFECT!' : '+1',
      color: isPerfect ? '#ffd166' : '#5be37a',
    })
    if (isPerfect) hapticNotify('success')

    activeRef.current = { x: 0, width: newWidth, color: colorForRow(placedRow + 1), dir: 1 }
  }

  const draw = (now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = config.theme.bg
    ctx.fillRect(0, 0, boardWidth, CANVAS_HEIGHT)

    const stack = stackRef.current
    const activeRow = stack.length
    const worldYActive = CANVAS_HEIGHT - (activeRow + 1) * blockHeight
    const cameraShift = Math.min(0, worldYActive - ACTIVE_ROW_Y)

    for (let row = 0; row < stack.length; row++) {
      const b = stack[row]
      const worldY = CANVAS_HEIGHT - (row + 1) * blockHeight
      const y = worldY - cameraShift
      if (y > CANVAS_HEIGHT || y + blockHeight < 0) continue
      ctx.fillStyle = b.color
      ctx.fillRect(b.x, y, b.width, blockHeight - 2)
    }

    if (!overRef.current) {
      const active = activeRef.current
      const y = worldYActive - cameraShift
      const pulse = 0.85 + 0.15 * Math.sin(now / 150)
      ctx.globalAlpha = pulse
      ctx.fillStyle = active.color
      ctx.fillRect(active.x, y, active.width, blockHeight - 2)
      ctx.globalAlpha = 1
    }

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        drop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet stack-sheet" style={{ '--stack-accent': config.theme.accent } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{title}</h3>

        {phase === 'ready' && (
          <>
            <p className="sheet-subtitle">
              Tap or press space to drop each block onto the tower. Land it square on the block below to keep your
              tower wide — miss completely and the tower topples. How high can you stack?
            </p>
            <button className="btn-primary" onClick={start}>
              Start
            </button>
          </>
        )}

        {(phase === 'playing' || phase === 'submitting') && (
          <>
            <div className="tap-game-hud">
              <span className="snake-hud-stat">🧱 Height: {score}</span>
            </div>
            <div className="stack-canvas-wrap" style={{ background: config.theme.bg }}>
              <canvas
                ref={canvasRef}
                width={boardWidth}
                height={CANVAS_HEIGHT}
                style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
                onPointerDown={drop}
              />
            </div>
            <button className="btn-primary stack-drop-btn" onClick={drop}>
              Drop
            </button>
          </>
        )}

        {phase === 'done' && (
          <div className="tap-game-result">
            {error ? (
              <p style={{ color: 'var(--down)', fontWeight: 600 }}>{error}</p>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700 }}>Tower height: {score}</p>
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
