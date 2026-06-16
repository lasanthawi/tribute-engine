import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { CrashConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

type Phase = 'ready' | 'playing' | 'submitting' | 'done'

const TICK_MS = 100

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

  const multiplierRef = useRef(100)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const lastTickRef = useRef(0)
  const endedRef = useRef(false)
  const multiplierTextRef = useRef<HTMLDivElement>(null)
  const rocketRef = useRef<HTMLDivElement>(null)

  const stopLoop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  useEffect(() => stopLoop, [])

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

  const crash = () => {
    if (endedRef.current) return
    endedRef.current = true
    stopLoop()
    hapticNotify('warning')
    setCrashed(true)
    setFinalScore(0)
    setTimeout(() => submit(0), 700)
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
    setCrashed(false)
    setResult(null)
    setError(null)
    setFinalScore(0)
    setPhase('playing')
    lastTimeRef.current = performance.now()

    const render = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      multiplierRef.current = Math.min(config.maxScore, multiplierRef.current + config.growthRate * dt)

      if (now - lastTickRef.current >= TICK_MS) {
        lastTickRef.current = now
        if (multiplierRef.current >= config.crashStartScore) {
          const over = (multiplierRef.current - config.crashStartScore) / 10
          const chance = config.baseCrashChance + config.crashChanceRamp * over
          if (Math.random() < chance) {
            crash()
            return
          }
        }
      }

      const mult = multiplierRef.current / 100
      if (multiplierTextRef.current) multiplierTextRef.current.textContent = `${mult.toFixed(2)}x`
      if (rocketRef.current) {
        const progress = (multiplierRef.current - 100) / (config.maxScore - 100)
        rocketRef.current.style.bottom = `${5 + progress * 85}%`
      }

      if (multiplierRef.current >= config.maxScore) {
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
            <p className="sheet-subtitle">
              Watch the multiplier climb as the rocket rises. Tap Cash Out any time to lock it in — but the longer
              you wait, the higher the risk the rocket explodes and you lose it all.
            </p>
            <button className="btn-primary" onClick={start}>
              Launch
            </button>
          </>
        )}

        {(phase === 'playing' || phase === 'submitting') && (
          <>
            <div className="crash-track" style={{ background: config.theme.bg }}>
              <div
                className="crash-multiplier"
                ref={multiplierTextRef}
                style={{
                  color: crashed ? config.theme.danger : config.theme.accent,
                  textShadow: `0 0 16px ${crashed ? config.theme.danger : config.theme.accent}`,
                }}
              >
                1.00x
              </div>
              <div ref={rocketRef} className={`crash-rocket ${crashed ? 'crash-rocket-exploded' : ''}`} style={{ bottom: '5%' }}>
                {crashed ? '💥' : '🚀'}
              </div>
            </div>
            <button className="btn-primary crash-cashout-btn" onClick={cashOut} disabled={phase !== 'playing'}>
              {crashed ? 'Crashed!' : 'Cash Out'}
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
                  {finalScore > 0 ? `Cashed out at ${(finalScore / 100).toFixed(2)}x` : '💥 Crashed before cash out'}
                </p>
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
