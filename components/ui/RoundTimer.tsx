import { useEffect, useState } from 'react'

const MIN = 60_000
const HOUR = 60 * MIN

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Compact form that always fits inside the timer ring (max ~4 chars). */
function formatRingValue(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  if (ms >= HOUR) return `${Math.floor(totalSeconds / 3600)}h`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function RoundTimer({ target, start, label }: { target: string; start?: string; label: string }) {
  const [remaining, setRemaining] = useState(() => new Date(target).getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(target).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [target])

  const urgent = remaining > 0 && remaining < 5 * MIN
  const total = start ? new Date(target).getTime() - new Date(start).getTime() : null
  const progress = total ? Math.max(0, Math.min(1, remaining / total)) : null

  if (progress === null) {
    return (
      <div className="round-timer">
        <div className="round-timer-label">{label}</div>
        <div className={`round-timer-value ${urgent ? 'urgent' : ''}`}>{formatRemaining(remaining)}</div>
      </div>
    )
  }

  return (
    <div className="round-timer">
      <div className="round-timer-label">{label}</div>
      <div className={`timer-ring ${urgent ? 'urgent' : ''}`}>
        <svg viewBox="0 0 52 52">
          <circle className="ring-track" cx="26" cy="26" r={RADIUS} />
          <circle
            className="ring-fill"
            cx="26"
            cy="26"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="timer-ring-value">{formatRingValue(remaining)}</div>
      </div>
    </div>
  )
}
