import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { CrashConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

type Phase = 'ready' | 'playing' | 'submitting' | 'done'
const TICK_MS = 100

function dangerColor(t: number, safe: string, danger: string): string {
  if (t < 0.25) return safe
  if (t < 0.55) return '#F59E0B'
  if (t < 0.8) return '#F97316'
  return danger
}

function rewardForMult(multX100: number, curve: CrashConfig['rewardCurve']): number {
  for (let i = curve.length - 1; i >= 0; i--) {
    if (multX100 >= curve[i].minScore) return curve[i].points
  }
  return 0
}

export default function CrashGame({
  slug,
  title,
  config,
  onComplete,
  onClose,
}: {
  slug: string
  title: string
  config: CrashConfig
  onComplete: (result: PlayResultDto) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [crashed, setCrashed] = useState(false)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const [autoCashout, setAutoCashout] = useState('')

  // DOM refs for hot-path updates (avoids React re-renders in rAF loop)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const multDisplayRef = useRef<HTMLDivElement>(null)
  const dangerBarRef = useRef<HTMLDivElement>(null)
  const riskTextRef = useRef<HTMLSpanElement>(null)
  const dangerLabelRef = useRef<HTMLSpanElement>(null)

  // Game state refs
  const multiplierRef = useRef(100)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const lastTickRef = useRef(0)
  const endedRef = useRef(false)
  const startTimeRef = useRef(0)
  const pointsRef = useRef<Array<{ x: number; y: number }>>([])

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }
  useEffect(() => stopLoop, [])

  const drawCanvas = (isCrashed: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    const pts = pointsRef.current

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = config.theme.bg
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, H * i / 4); ctx.lineTo(W, H * i / 4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W * i / 4, 0); ctx.lineTo(W * i / 4, H); ctx.stroke()
    }

    // Danger zone shading — red tint where crash can happen
    const dangerStartX = ((config.crashStartScore - 100) / (config.maxScore - 100)) * W
    if (dangerStartX < W) {
      const dg = ctx.createLinearGradient(dangerStartX, 0, W, 0)
      dg.addColorStop(0, `${config.theme.danger}00`)
      dg.addColorStop(0.4, `${config.theme.danger}15`)
      dg.addColorStop(1, `${config.theme.danger}32`)
      ctx.fillStyle = dg
      ctx.fillRect(dangerStartX, 0, W - dangerStartX, H)
    }

    // Reward tier dashed markers
    const tiers = config.rewardCurve.filter(t => t.points > 0 && t.minScore > 100)
    ctx.setLineDash([3, 6])
    for (const t of tiers.slice(0, 5)) {
      const tx = ((t.minScore - 100) / (config.maxScore - 100)) * W
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, H - 16); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`+${t.points}`, tx, H - 4)
    }
    ctx.setLineDash([])

    if (pts.length < 2) return

    const lineColor = isCrashed ? config.theme.danger : config.theme.accent

    // Fill under chart line
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H)
    fillGrad.addColorStop(0, `${lineColor}28`)
    fillGrad.addColorStop(1, `${lineColor}00`)
    ctx.beginPath()
    ctx.moveTo(pts[0].x, H)
    for (const p of pts) ctx.lineTo(p.x, p.y)
    ctx.lineTo(pts[pts.length - 1].x, H)
    ctx.closePath()
    ctx.fillStyle = fillGrad
    ctx.fill()

    // Chart line — gradient from safe accent to orange/danger as it moves right
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0)
    const safeRatio = Math.min(0.98, (config.crashStartScore - 100) / (config.maxScore - 100))
    lineGrad.addColorStop(0, config.theme.accent)
    lineGrad.addColorStop(safeRatio, config.theme.accent)
    lineGrad.addColorStop(Math.min(0.99, safeRatio + 0.15), '#F59E0B')
    lineGrad.addColorStop(1, isCrashed ? config.theme.danger : '#F97316')
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Glow at current tip
    const last = pts[pts.length - 1]
    if (!isCrashed) {
      const glow = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 16)
      glow.addColorStop(0, `${config.theme.accent}aa`)
      glow.addColorStop(1, `${config.theme.accent}00`)
      ctx.beginPath(); ctx.arc(last.x, last.y, 16, 0, Math.PI * 2)
      ctx.fillStyle = glow; ctx.fill()
      ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
    }

    // Rocket / explosion emoji at chart tip
    ctx.save()
    ctx.font = '22px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    if (!isCrashed) {
      ctx.translate(last.x, last.y - 2)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText('🚀', 0, 0)
    } else {
      ctx.fillText('💥', last.x, last.y)
    }
    ctx.restore()
  }

  const submit = async (score: number) => {
    setPhase('submitting')
    try {
      const res = await api.playGame(slug, { score })
      setResult(res)
      hapticNotify(score > 0 ? 'success' : 'error')
      setPhase('done')
      onComplete(res)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      hapticNotify('error')
      setPhase('done')
    }
  }

  const doCrash = () => {
    if (endedRef.current) return
    endedRef.current = true
    stopLoop()
    hapticNotify('warning')
    setCrashed(true)
    setFinalScore(0)
    drawCanvas(true)
    setTimeout(() => submit(0), 900)
  }

  const cashOut = () => {
    if (phase !== 'playing' || endedRef.current) return
    endedRef.current = true
    stopLoop()
    haptic('medium')
    const score = Math.min(config.maxScore, Math.round(multiplierRef.current))
    setFinalScore(score)
    submit(score)
  }

  const start = () => {
    multiplierRef.current = 100
    endedRef.current = false
    lastTickRef.current = 0
    pointsRef.current = []
    setCrashed(false)
    setResult(null)
    setError(null)
    setFinalScore(0)
    setPhase('playing')
    startTimeRef.current = performance.now()
    lastTimeRef.current = performance.now()

    const autoTarget = autoCashout ? parseFloat(autoCashout) * 100 : null
    const milestonesHit = new Set<number>()
    const milestoneScores = config.rewardCurve.filter(t => t.points > 0).map(t => t.minScore)
    const totalMs = ((config.maxScore - 100) / config.growthRate) * 1000

    const render = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now
      multiplierRef.current = Math.min(config.maxScore, multiplierRef.current + config.growthRate * dt)
      const mult = multiplierRef.current

      // Record canvas point
      const canvas = canvasRef.current
      if (canvas) {
        const elapsed = now - startTimeRef.current
        const x = Math.min(canvas.width - 2, (elapsed / totalMs) * canvas.width)
        const progress = (mult - 100) / (config.maxScore - 100)
        const y = canvas.height - 6 - progress * (canvas.height - 22)
        pointsRef.current.push({ x, y })
        drawCanvas(false)
      }

      // Danger level (0–1)
      const dangerT = mult >= config.crashStartScore
        ? Math.min(1, (mult - config.crashStartScore) / ((config.maxScore - config.crashStartScore) * 0.7))
        : 0
      const color = dangerColor(dangerT, config.theme.accent, config.theme.danger)

      // Update HUD DOM refs without re-render
      if (multDisplayRef.current) {
        multDisplayRef.current.textContent = `${(mult / 100).toFixed(2)}x`
        multDisplayRef.current.style.color = color
        multDisplayRef.current.style.textShadow = `0 0 28px ${color}`
      }
      if (dangerBarRef.current) {
        dangerBarRef.current.style.width = `${Math.min(100, dangerT * 100)}%`
        dangerBarRef.current.style.background = color
      }
      if (riskTextRef.current) {
        if (mult >= config.crashStartScore) {
          const over = (mult - config.crashStartScore) / 10
          const pct = Math.min(95, (config.baseCrashChance + config.crashChanceRamp * over) * 10 * 100)
          riskTextRef.current.textContent = `${pct.toFixed(0)}% crash risk`
          riskTextRef.current.style.color = color
        } else {
          riskTextRef.current.textContent = 'Safe zone'
          riskTextRef.current.style.color = config.theme.accent
        }
      }
      if (dangerLabelRef.current) {
        if (dangerT > 0.8) dangerLabelRef.current.textContent = '🔴 CRITICAL'
        else if (dangerT > 0.55) dangerLabelRef.current.textContent = '🟠 Danger'
        else if (dangerT > 0.2) dangerLabelRef.current.textContent = '🟡 Risky'
        else dangerLabelRef.current.textContent = '🟢 Safe'
      }

      // Haptic pulse at each reward milestone
      for (const ms of milestoneScores) {
        if (mult >= ms && !milestonesHit.has(ms)) {
          milestonesHit.add(ms)
          haptic('light')
        }
      }

      // Auto cash-out
      if (autoTarget && mult >= autoTarget && !endedRef.current) {
        cashOut()
        return
      }

      // Crash check every TICK_MS
      if (now - lastTickRef.current >= TICK_MS) {
        lastTickRef.current = now
        if (mult >= config.crashStartScore) {
          const over = (mult - config.crashStartScore) / 10
          const chance = config.baseCrashChance + config.crashChanceRamp * over
          if (Math.random() < chance) { doCrash(); return }
        }
      }

      if (mult >= config.maxScore) {
        endedRef.current = true
        haptic('heavy')
        setFinalScore(config.maxScore)
        submit(config.maxScore)
        return
      }

      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
  }

  const autoPts = autoCashout && !isNaN(parseFloat(autoCashout))
    ? rewardForMult(parseFloat(autoCashout) * 100, config.rewardCurve)
    : null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet crash-sheet ${crashed ? 'crash-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h3 className="sheet-title">{title}</h3>

        {phase === 'ready' && (
          <>
            {/* Reward tier strip — tells the player what each multiplier earns */}
            <div className="crash-reward-strip">
              {config.rewardCurve.filter(t => t.points > 0).map(t => (
                <div key={t.minScore} className="crash-reward-tier">
                  <span className="crash-tier-mult">{(t.minScore / 100).toFixed(1)}x</span>
                  <span className="crash-tier-pts">+{t.points}pts</span>
                </div>
              ))}
            </div>

            <p className="crash-hint">
              Rocket climbs — cash out to lock in your reward. Crash risk begins at{' '}
              <strong>{(config.crashStartScore / 100).toFixed(1)}x</strong> and increases the longer you hold.
              <br />Set an auto target, or react manually during launch.
            </p>

            <div className="crash-auto-row">
              <span className="crash-auto-label">Auto cash-out at</span>
              <input
                className="crash-auto-input"
                type="number"
                step="0.1"
                min="1.1"
                max={(config.maxScore / 100).toFixed(1)}
                placeholder={`e.g. ${(config.crashStartScore / 100 + 0.5).toFixed(1)}`}
                value={autoCashout}
                onChange={(e) => setAutoCashout(e.target.value)}
              />
              <span className="crash-auto-unit">×</span>
              {autoPts !== null && (
                <span className="crash-auto-preview">→ +{autoPts}pts</span>
              )}
            </div>

            <button className="btn-primary" onClick={start}>
              🚀 Launch
            </button>
          </>
        )}

        {(phase === 'playing' || phase === 'submitting') && (
          <>
            <div className="crash-canvas-wrap">
              <canvas ref={canvasRef} className="crash-canvas" width={320} height={190} />
            </div>

            <div className="crash-hud">
              <div ref={multDisplayRef} className="crash-mult-display" style={{ color: config.theme.accent }}>
                1.00x
              </div>
              <div className="crash-hud-right">
                <span ref={dangerLabelRef} className="crash-danger-label">🟢 Safe</span>
                <span ref={riskTextRef} className="crash-risk-text" style={{ color: config.theme.accent }}>
                  Safe zone
                </span>
              </div>
            </div>

            <div className="crash-bar-track">
              <div ref={dangerBarRef} className="crash-bar-fill" style={{ background: config.theme.accent }} />
            </div>
            <div className="crash-bar-ends">
              <span>1.00x</span>
              <span>crash risk starts at {(config.crashStartScore / 100).toFixed(1)}x</span>
              <span>{(config.maxScore / 100).toFixed(1)}x</span>
            </div>

            <button
              className={`crash-cashout-btn${crashed ? ' crash-cashout-crashed' : ''}`}
              onClick={cashOut}
              disabled={phase !== 'playing' || endedRef.current}
            >
              {crashed ? '💥 Crashed!' : '💰 Cash Out Now'}
            </button>
          </>
        )}

        {phase === 'done' && (
          <div className="tap-game-result">
            {error ? (
              <p style={{ color: 'var(--down)', fontWeight: 600 }}>{error}</p>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700 }}>
                  {finalScore > 0
                    ? `✅ Cashed out at ${(finalScore / 100).toFixed(2)}x`
                    : '💥 Crashed before cash out'}
                </p>
                <p className="stack-reward-pop" style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                  +{result?.rewardPoints ?? 0} pts
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                  {result && result.remainingPlays > 0
                    ? `${result.remainingPlays} plays left today`
                    : 'Come back tomorrow'}
                </p>
              </>
            )}
            <div className="crash-result-actions">
              {result && result.remainingPlays > 0 && !error && (
                <button className="btn-secondary" style={{ flex: 1 }} onClick={start}>
                  Play Again
                </button>
              )}
              <button className="btn-primary" style={{ flex: 1 }} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
      {phase === 'done' && !error && (result?.rewardPoints ?? 0) >= 30 && <Confetti />}
    </div>
  )
}
