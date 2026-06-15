import { levelProgress } from '@/lib/xp-client'

export default function XpRing({
  xp,
  level,
  size = 76,
  progressColor = '#ffffff',
  trackColor = 'rgba(255,255,255,0.35)',
  textColor = '#ffffff',
}: {
  xp: number
  level: number
  size?: number
  progressColor?: string
  trackColor?: string
  textColor?: string
}) {
  const progress = levelProgress(xp, level)
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  return (
    <div className="xp-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="xp-ring-label" style={{ color: textColor }}>
        <span className="xp-ring-level">{level}</span>
        <span className="xp-ring-sub">LVL</span>
      </div>
    </div>
  )
}
