import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { TapCatchConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 360

const DIRECTION_VERBS: Record<NonNullable<TapCatchConfig['direction']>, string> = {
  down: 'falling',
  up: 'rising',
  left: 'drifting',
  right: 'drifting',
}

interface FallingObject {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  objectId: string
  label: string
  color: string
  iconUrl?: string
  isHazard: boolean
}

interface FloatingText {
  id: number
  x: number
  y: number
  createdAt: number
  label: string
  color: string
}

type Phase = 'ready' | 'playing' | 'submitting' | 'done'

export default function TapGame({
  slug,
  title,
  config,
  onComplete,
  onClose,
}: {
  slug: string
  title: string
  config: TapCatchConfig
  onComplete: (result: PlayResultDto) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(config.durationSec)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const objectsRef = useRef<FallingObject[]>([])
  const floatingRef = useRef<FloatingText[]>([])
  const scoreRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const nextSpawnRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextIdRef = useRef(0)
  const iconCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (intervalRef.current !== null) clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  // Preload object/hazard logo images (if any) so render() can draw them once decoded.
  useEffect(() => {
    const urls = new Set<string>()
    for (const obj of [...config.objects, ...(config.hazards ?? [])]) {
      if (obj.iconUrl) urls.add(obj.iconUrl)
    }
    Array.from(urls).forEach((url) => {
      if (iconCacheRef.current.has(url)) return
      const img = new Image()
      img.src = url
      iconCacheRef.current.set(url, img)
    })
  }, [config.objects, config.hazards])

  useEffect(() => stopLoop, [])

  const direction = config.direction ?? 'down'
  const hazards = config.hazards ?? []
  const hazardPenalty = config.hazardPenalty ?? 1
  const speedRamp = config.speedRamp ?? 0

  const pickObject = (): { obj: TapCatchConfig['objects'][number]; isHazard: boolean } => {
    const pool = [
      ...config.objects.map((o) => ({ obj: o, isHazard: false })),
      ...hazards.map((o) => ({ obj: o, isHazard: true })),
    ]
    const totalWeight = pool.reduce((sum, p) => sum + p.obj.weight, 0)
    let roll = Math.random() * totalWeight
    for (const p of pool) {
      roll -= p.obj.weight
      if (roll <= 0) return p
    }
    return pool[pool.length - 1]
  }

  const start = () => {
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(config.durationSec)
    objectsRef.current = []
    floatingRef.current = []
    nextSpawnRef.current = 0
    setPhase('playing')

    const startedAt = performance.now()
    let last = startedAt

    const loop = (now: number) => {
      const dt = now - last
      last = now
      const elapsedSec = (now - startedAt) / 1000
      const rampMultiplier = 1 + speedRamp * elapsedSec

      nextSpawnRef.current -= dt
      if (nextSpawnRef.current <= 0) {
        const { obj, isHazard } = pickObject()
        const size = 24 + Math.random() * 10
        const speed = (2 + Math.random() * 2) * (dt / 16.67 || 1) * rampMultiplier
        let x = 0
        let y = 0
        let vx = 0
        let vy = 0
        switch (direction) {
          case 'up':
            x = size + Math.random() * (CANVAS_WIDTH - size * 2)
            y = CANVAS_HEIGHT + size
            vy = -speed
            break
          case 'left':
            x = CANVAS_WIDTH + size
            y = size + Math.random() * (CANVAS_HEIGHT - size * 2)
            vx = -speed
            break
          case 'right':
            x = -size
            y = size + Math.random() * (CANVAS_HEIGHT - size * 2)
            vx = speed
            break
          default:
            x = size + Math.random() * (CANVAS_WIDTH - size * 2)
            y = -size
            vy = speed
        }
        objectsRef.current.push({
          id: nextIdRef.current++,
          x,
          y,
          vx,
          vy,
          size,
          objectId: obj.id,
          label: obj.label,
          color: obj.color,
          iconUrl: obj.iconUrl,
          isHazard,
        })
        nextSpawnRef.current = config.spawnMinMs + Math.random() * (config.spawnMaxMs - config.spawnMinMs)
      }

      objectsRef.current = objectsRef.current
        .map((c) => ({ ...c, x: c.x + c.vx, y: c.y + c.vy }))
        .filter((c) => c.x > -c.size * 2 && c.x < CANVAS_WIDTH + c.size * 2 && c.y > -c.size * 2 && c.y < CANVAS_HEIGHT + c.size * 2)

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

    for (const obj of objectsRef.current) {
      ctx.beginPath()
      ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2)
      ctx.fillStyle = obj.color
      ctx.fill()
      if (obj.isHazard) {
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fff'
        ctx.setLineDash([4, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
      const icon = obj.iconUrl ? iconCacheRef.current.get(obj.iconUrl) : undefined
      if (icon && icon.complete && icon.naturalWidth > 0) {
        const iconSize = obj.size * 1.15
        ctx.drawImage(icon, obj.x - iconSize / 2, obj.y - iconSize / 2, iconSize, iconSize)
      } else {
        ctx.fillStyle = '#fff'
        ctx.font = `${Math.round(obj.size)}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(obj.label, obj.x, obj.y + 1)
      }
    }

    for (const f of floatingRef.current) {
      const age = (now - f.createdAt) / 700
      ctx.globalAlpha = Math.max(0, 1 - age)
      ctx.fillStyle = f.color
      ctx.font = 'bold 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(f.label, f.x, f.y - age * 30)
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

    const hitIndex = objectsRef.current.findIndex((c) => {
      const dx = c.x - x
      const dy = c.y - y
      return Math.sqrt(dx * dx + dy * dy) <= c.size
    })

    if (hitIndex >= 0) {
      const obj = objectsRef.current[hitIndex]
      objectsRef.current = objectsRef.current.filter((_, i) => i !== hitIndex)
      if (obj.isHazard) {
        scoreRef.current = Math.max(0, scoreRef.current - hazardPenalty)
        floatingRef.current.push({ id: nextIdRef.current++, x: obj.x, y: obj.y, createdAt: performance.now(), label: `-${hazardPenalty}`, color: '#ff5c5c' })
        haptic('heavy')
      } else {
        scoreRef.current += 1
        floatingRef.current.push({ id: nextIdRef.current++, x: obj.x, y: obj.y, createdAt: performance.now(), label: '+1', color: '#5be37a' })
        haptic('light')
      }
      setScore(scoreRef.current)
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
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{title}</h3>

        {phase === 'ready' && (
          <>
            <p className="sheet-subtitle">
              Tap the {DIRECTION_VERBS[direction]} objects for {config.durationSec} seconds. Earn points based on your score!
              {hazards.length > 0 && ` Avoid the dashed-outline objects — they cost you ${hazardPenalty} point${hazardPenalty === 1 ? '' : 's'}!`}
            </p>
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
            <div className="tap-game-canvas-wrap" style={{ background: `linear-gradient(180deg, ${config.theme.bg}, var(--bg))` }}>
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
