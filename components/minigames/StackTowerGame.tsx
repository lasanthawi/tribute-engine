import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { StackTowerConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

const CANVAS_HEIGHT = 420
const ACTIVE_ROW_Y = 90
const MIN_OVERLAP = 4
const SQUASH_MS = 220
const SHAKE_MS = 280
const FLASH_MS = 220

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
  big?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  createdAt: number
  life: number
  color: string
  size: number
}

/** Lightens a hex color by mixing it toward white by `amt` (0-1). */
function lighten(hex: string, amt: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amt)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

/** Darkens a hex color by mixing it toward black by `amt` (0-1). */
function darken(hex: string, amt: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.substring(0, 2), 16)
  const g = parseInt(m.substring(2, 4), 16)
  const b = parseInt(m.substring(4, 6), 16)
  const mix = (c: number) => Math.round(c * (1 - amt))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
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
  const [combo, setCombo] = useState(0)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stackRef = useRef<Block[]>([])
  const activeRef = useRef<ActiveBlock>({ x: 0, width: config.blockWidth, color: config.theme.accent, dir: 1 })
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const floatingRef = useRef<FloatingText[]>([])
  const particlesRef = useRef<Particle[]>([])
  const nextIdRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const overRef = useRef(false)
  const shakeUntilRef = useRef(0)
  const flashRef = useRef<{ until: number; color: string } | null>(null)
  const landedRowRef = useRef<{ row: number; at: number } | null>(null)

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

  const spawnParticles = (x: number, y: number, color: string, count: number, spread: number) => {
    const now = performance.now()
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread
      const speed = 60 + Math.random() * 140
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        createdAt: now,
        life: 500 + Math.random() * 400,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }

  const gameOver = () => {
    overRef.current = true
    hapticNotify('warning')
    const now = performance.now()
    shakeUntilRef.current = now + SHAKE_MS
    flashRef.current = { until: now + FLASH_MS, color: 'rgba(255,92,92,0.35)' }
    const active = activeRef.current
    const worldYActive = CANVAS_HEIGHT - (stackRef.current.length + 1) * blockHeight
    spawnParticles(active.x + active.width / 2, worldYActive + blockHeight / 2, active.color, 22, Math.PI * 1.4)
    stopLoop()
    // Let the toppling effect play briefly before submitting.
    setTimeout(() => {
      draw(performance.now())
      submit()
    }, 260)
  }

  const start = () => {
    stackRef.current = [{ x: 0, width: boardWidth, color: config.theme.accent }]
    activeRef.current = { x: 0, width: config.blockWidth, color: colorForRow(1), dir: 1 }
    scoreRef.current = 0
    comboRef.current = 0
    floatingRef.current = []
    particlesRef.current = []
    landedRowRef.current = null
    shakeUntilRef.current = 0
    flashRef.current = null
    overRef.current = false
    setScore(0)
    setCombo(0)
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
      floatingRef.current = floatingRef.current.filter((f) => now - f.createdAt < 800)
      particlesRef.current = particlesRef.current.filter((p) => now - p.createdAt < p.life)
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

    const now = performance.now()
    landedRowRef.current = { row: placedRow, at: now }
    const worldY = CANVAS_HEIGHT - (placedRow + 1) * blockHeight

    if (isPerfect) {
      comboRef.current += 1
      hapticNotify('success')
      flashRef.current = { until: now + FLASH_MS, color: 'rgba(255,209,102,0.25)' }
      spawnParticles(newX + newWidth / 2, worldY, '#ffd166', 18, Math.PI * 1.6)
    } else {
      comboRef.current = 0
      spawnParticles(newX + newWidth / 2, worldY, colorForRow(placedRow), 8, Math.PI * 0.9)
    }
    setCombo(comboRef.current)

    floatingRef.current.push({
      id: nextIdRef.current++,
      x: newX + newWidth / 2,
      y: ACTIVE_ROW_Y,
      createdAt: now,
      label: isPerfect ? (comboRef.current >= 2 ? `PERFECT! x${comboRef.current}` : 'PERFECT!') : '+1',
      color: isPerfect ? '#ffd166' : '#5be37a',
      big: isPerfect,
    })

    activeRef.current = { x: 0, width: newWidth, color: colorForRow(placedRow + 1), dir: 1 }
  }

  const draw = (now: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()

    // Screen shake on miss
    if (now < shakeUntilRef.current) {
      const remaining = (shakeUntilRef.current - now) / SHAKE_MS
      const mag = 6 * remaining
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag)
    }

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    bgGrad.addColorStop(0, lighten(config.theme.bg, 0.08))
    bgGrad.addColorStop(1, config.theme.bg)
    ctx.fillStyle = bgGrad
    ctx.fillRect(-20, -20, boardWidth + 40, CANVAS_HEIGHT + 40)

    // Ambient accent glow near the top
    const glow = ctx.createRadialGradient(boardWidth / 2, 40, 10, boardWidth / 2, 40, boardWidth * 0.8)
    glow.addColorStop(0, `${config.theme.accent}33`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(-20, -20, boardWidth + 40, CANVAS_HEIGHT + 40)

    const stack = stackRef.current
    const activeRow = stack.length
    const worldYActive = CANVAS_HEIGHT - (activeRow + 1) * blockHeight
    const cameraShift = Math.min(0, worldYActive - ACTIVE_ROW_Y)

    // Parallax grid lines that scroll with the camera
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    const gridSpacing = blockHeight
    const offset = ((-cameraShift) % gridSpacing + gridSpacing) % gridSpacing
    for (let y = -offset; y < CANVAS_HEIGHT + gridSpacing; y += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(boardWidth, y)
      ctx.stroke()
    }

    // Landing guide — shows where the active block needs to land
    if (!overRef.current) {
      const prev = stack[stack.length - 1]
      const guideY = worldYActive - cameraShift
      ctx.save()
      ctx.setLineDash([5, 5])
      ctx.lineWidth = 2
      ctx.strokeStyle = `${config.theme.accent}66`
      roundRectPath(ctx, prev.x, guideY, prev.width, blockHeight - 2, 4)
      ctx.stroke()
      ctx.restore()
    }

    // Stacked blocks
    for (let row = 0; row < stack.length; row++) {
      const b = stack[row]
      const worldY = CANVAS_HEIGHT - (row + 1) * blockHeight
      let y = worldY - cameraShift
      let h = blockHeight - 2
      let x = b.x
      let w = b.width
      if (y > CANVAS_HEIGHT || y + h < 0) continue

      // Squash-and-settle bounce for the most recently landed block
      const landed = landedRowRef.current
      if (landed && landed.row === row) {
        const t = Math.min(1, (now - landed.at) / SQUASH_MS)
        if (t < 1) {
          const scaleY = 0.72 + 0.28 * easeOutBack(t)
          const newH = h * scaleY
          y += h - newH
          h = newH
        }
      }

      const grad = ctx.createLinearGradient(x, y, x, y + h)
      grad.addColorStop(0, lighten(b.color, 0.35))
      grad.addColorStop(0.4, b.color)
      grad.addColorStop(1, darken(b.color, 0.25))
      ctx.fillStyle = grad
      roundRectPath(ctx, x, y, w, h, 4)
      ctx.fill()

      // Top highlight sheen
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      roundRectPath(ctx, x + 2, y + 1, w - 4, Math.max(2, h * 0.25), 3)
      ctx.fill()
    }

    // Active (falling/oscillating) block
    if (!overRef.current) {
      const active = activeRef.current
      const y = worldYActive - cameraShift
      const pulse = 0.9 + 0.1 * Math.sin(now / 150)

      // Soft glow behind the active block
      ctx.save()
      ctx.shadowColor = active.color
      ctx.shadowBlur = 16
      ctx.globalAlpha = pulse
      const grad = ctx.createLinearGradient(active.x, y, active.x, y + blockHeight - 2)
      grad.addColorStop(0, lighten(active.color, 0.35))
      grad.addColorStop(0.4, active.color)
      grad.addColorStop(1, darken(active.color, 0.25))
      ctx.fillStyle = grad
      roundRectPath(ctx, active.x, y, active.width, blockHeight - 2, 4)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      roundRectPath(ctx, active.x + 2, y + 1, active.width - 4, Math.max(2, (blockHeight - 2) * 0.25), 3)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Particle bursts
    for (const p of particlesRef.current) {
      const age = (now - p.createdAt) / 1000
      const alpha = Math.max(0, 1 - (now - p.createdAt) / p.life)
      const px = p.x + p.vx * age
      const py = p.y + p.vy * age + 0.5 * 360 * age * age
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Floating score / combo text
    for (const f of floatingRef.current) {
      const age = (now - f.createdAt) / 800
      const alpha = Math.max(0, 1 - age)
      const scale = f.big ? 1 + Math.min(0.4, age * 1.2) * (1 - age) : 1
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(f.x, f.y - age * 32)
      ctx.scale(scale, scale)
      ctx.textAlign = 'center'
      if (f.big) {
        ctx.font = 'bold 20px sans-serif'
        ctx.shadowColor = f.color
        ctx.shadowBlur = 12
      } else {
        ctx.font = 'bold 16px sans-serif'
      }
      ctx.fillStyle = f.color
      ctx.fillText(f.label, 0, 0)
      ctx.restore()
    }

    // Impact flash overlay
    if (flashRef.current && now < flashRef.current.until) {
      const alpha = (flashRef.current.until - now) / FLASH_MS
      ctx.globalAlpha = alpha
      ctx.fillStyle = flashRef.current.color
      ctx.fillRect(-20, -20, boardWidth + 40, CANVAS_HEIGHT + 40)
      ctx.globalAlpha = 1
    }

    ctx.restore()
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
              <span className="snake-hud-stat" key={score}>
                🧱 Height: <span className="stack-score-pop">{score}</span>
              </span>
              {combo >= 2 && (
                <span className="stack-combo-badge" key={combo}>
                  🔥 Combo x{combo}
                </span>
              )}
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
                <p className="stack-reward-pop" style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                  +{result?.rewardPoints ?? 0} pts
                </p>
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
