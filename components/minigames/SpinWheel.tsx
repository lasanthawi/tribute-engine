import { useRef, useState } from 'react'
import { api, SpinResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import Confetti from '@/components/ui/Confetti'

// Must match lib/minigames.ts SPIN_SEGMENTS order
const SEGMENT_LABELS = ['10 pts', '20 pts', '50 pts', '5 coins', '100 pts', '1 ticket', 'Jackpot 250']
const SEGMENT_COLORS = [
  'var(--accent)',
  'var(--gold)',
  'var(--up)',
  'var(--ton)',
  'var(--btc)',
  'var(--eth)',
  'var(--down)',
]

const SEGMENTS = SEGMENT_LABELS.length
const SEGMENT_ANGLE = 360 / SEGMENTS
const RADIUS = 130
const CENTER = 130

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

function wedgePath(index: number) {
  const start = polarToCartesian(index * SEGMENT_ANGLE)
  const end = polarToCartesian((index + 1) * SEGMENT_ANGLE)
  return `M${CENTER},${CENTER} L${start.x},${start.y} A${RADIUS},${RADIUS} 0 0,1 ${end.x},${end.y} Z`
}

type Phase = 'ready' | 'spinning' | 'done'

export default function SpinWheel({
  remainingPlays,
  onComplete,
}: {
  remainingPlays: number
  onComplete: (result: SpinResultDto) => void
}) {
  const [phase, setPhase] = useState<Phase>(remainingPlays < 1 ? 'done' : 'ready')
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<SpinResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<SpinResultDto | null>(null)

  const handleSpin = async () => {
    if (phase !== 'ready') return
    haptic('medium')
    setPhase('spinning')
    try {
      const res = await api.spinWheel()
      pendingRef.current = res
      const baseSpins = 4 + Math.floor(Math.random() * 2)
      const target = baseSpins * 360 + (360 - res.segmentIndex * SEGMENT_ANGLE) - SEGMENT_ANGLE / 2
      setRotation(target)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setResult(null)
      setPhase('done')
    }
  }

  const handleTransitionEnd = () => {
    if (phase !== 'spinning') return
    const res = pendingRef.current
    if (!res) return
    setResult(res)
    hapticNotify('success')
    setPhase('done')
    onComplete(res)
  }

  const showBigWin = !!result && (result.rewardPoints >= 100 || result.rewardTickets > 0 || result.rewardCoins > 0)

  return (
    <div>
      <div className="spin-wheel-wrap">
        <div className="spin-wheel-pointer" />
        <svg
          className="spin-wheel-svg"
          viewBox="0 0 260 260"
          style={{ transform: `rotate(${rotation}deg)` }}
          onTransitionEnd={handleTransitionEnd}
        >
          {SEGMENT_LABELS.map((label, i) => {
            const mid = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
            const labelPos = {
              x: CENTER + (RADIUS - 35) * Math.cos(((mid - 90) * Math.PI) / 180),
              y: CENTER + (RADIUS - 35) * Math.sin(((mid - 90) * Math.PI) / 180),
            }
            return (
              <g key={label}>
                <path d={wedgePath(i)} fill={SEGMENT_COLORS[i]} stroke="var(--bg)" strokeWidth={2} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#fff"
                  fontSize={12}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {phase === 'ready' && (
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleSpin}>
          Spin
        </button>
      )}

      {phase === 'spinning' && (
        <button className="btn-primary" style={{ marginTop: 20 }} disabled>
          Spinning...
        </button>
      )}

      {phase === 'done' && (
        <div className="spin-wheel-result">
          {error ? (
            <p style={{ color: 'var(--down)', fontWeight: 600 }}>{error}</p>
          ) : result ? (
            <>
              <p style={{ fontSize: 22, fontWeight: 800 }}>
                {result.rewardPoints > 0 && `+${result.rewardPoints} pts`}
                {result.rewardTickets > 0 && `+${result.rewardTickets} ticket`}
                {result.rewardCoins > 0 && `+${result.rewardCoins} coins`}
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>Come back tomorrow for another spin</p>
            </>
          ) : (
            <p style={{ color: 'var(--text-dim)', fontSize: 13, fontWeight: 600 }}>Come back tomorrow</p>
          )}
        </div>
      )}

      {showBigWin && <Confetti />}
    </div>
  )
}
