import { useEffect, useRef, useState } from 'react'
import { api, PlayResultDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'
import { SpinWheelConfig } from '@/lib/game-templates'
import Confetti from '@/components/ui/Confetti'

const SEGMENT_COLOR_PALETTE = [
  'var(--accent)',
  'var(--gold)',
  'var(--up)',
  'var(--ton)',
  'var(--btc)',
  'var(--eth)',
  'var(--down)',
]

const RADIUS = 130
const CENTER = 130

function polarToCartesian(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

type Phase = 'ready' | 'spinning' | 'done'

export default function SpinWheel({
  slug,
  config,
  remainingPlays,
  onComplete,
}: {
  slug: string
  config: SpinWheelConfig
  remainingPlays: number
  onComplete: (result: PlayResultDto) => void
}) {
  const [phase, setPhase] = useState<Phase>(remainingPlays < 1 ? 'done' : 'ready')
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<PlayResultDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<PlayResultDto | null>(null)

  const segments = config.segments
  const segmentAngle = 360 / segments.length

  const wedgePath = (index: number) => {
    const start = polarToCartesian(index * segmentAngle)
    const end = polarToCartesian((index + 1) * segmentAngle)
    return `M${CENTER},${CENTER} L${start.x},${start.y} A${RADIUS},${RADIUS} 0 0,1 ${end.x},${end.y} Z`
  }

  const handleSpin = async () => {
    if (phase !== 'ready') return
    haptic('medium')
    setPhase('spinning')
    try {
      const res = await api.playGame(slug)
      pendingRef.current = res
      const segmentIndex = res.segmentIndex ?? 0
      const baseSpins = 6 + Math.floor(Math.random() * 2)
      const target = baseSpins * 360 + (360 - segmentIndex * segmentAngle) - segmentAngle / 2
      setRotation(target)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setResult(null)
      setPhase('done')
    }
  }

  // Decelerating "tick" haptics while the wheel spins down, for a slot-machine feel.
  useEffect(() => {
    if (phase !== 'spinning') return
    const delays = [120, 140, 160, 190, 230, 280, 340, 420, 520, 650, 800, 1000, 1250]
    const timers = delays.reduce<{ list: ReturnType<typeof setTimeout>[]; total: number }>(
      (acc, delay) => {
        acc.total += delay
        acc.list.push(setTimeout(() => haptic('light'), acc.total))
        return acc
      },
      { list: [], total: 0 }
    ).list
    return () => timers.forEach(clearTimeout)
  }, [phase])

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
      <div className={`spin-wheel-wrap${phase === 'spinning' ? ' spinning' : ''}`}>
        <div className="spin-wheel-pointer" />
        <svg
          className="spin-wheel-svg"
          viewBox="0 0 260 260"
          style={{ transform: `rotate(${rotation}deg)` }}
          onTransitionEnd={handleTransitionEnd}
        >
          <defs>
            {segments.map((_, i) => {
              const color = SEGMENT_COLOR_PALETTE[i % SEGMENT_COLOR_PALETTE.length]
              return (
                <radialGradient key={i} id={`spin-seg-${i}`} cx="50%" cy="50%" r="75%">
                  <stop offset="0%" stopColor={color} stopOpacity={0.75} />
                  <stop offset="100%" stopColor={color} stopOpacity={1} />
                </radialGradient>
              )
            })}
          </defs>
          {segments.map((segment, i) => {
            const mid = i * segmentAngle + segmentAngle / 2
            const labelPos = {
              x: CENTER + (RADIUS - 38) * Math.cos(((mid - 90) * Math.PI) / 180),
              y: CENTER + (RADIUS - 38) * Math.sin(((mid - 90) * Math.PI) / 180),
            }
            return (
              <g key={i}>
                <path d={wedgePath(i)} fill={`url(#spin-seg-${i})`} stroke="var(--bg-card)" strokeWidth={2} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill="#fff"
                  fontSize={12}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                >
                  {segment.label}
                </text>
              </g>
            )
          })}
          <circle className="spin-wheel-hub" cx={CENTER} cy={CENTER} r={22} />
          <text x={CENTER} y={CENTER} className="spin-wheel-hub-icon" dy="1">
            🎯
          </text>
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
