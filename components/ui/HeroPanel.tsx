import { useEffect, useState } from 'react'
import { RoundDto } from '@/lib/api-client'

const MIN = 60_000
const HOUR = 60 * MIN

function formatRingValue(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  if (ms >= HOUR) return `${Math.floor(totalSeconds / 3600)}h`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export type HeroPanelView = 'countdown' | 'tickets' | 'boost' | 'markets'

interface NextEvent {
  target: string
  start: string
  label: string
}

function getNextEvent(rounds: RoundDto[] | null): NextEvent | null {
  if (!rounds || rounds.length === 0) return null
  let best: (NextEvent & { time: number }) | null = null
  for (const r of rounds) {
    const candidate: NextEvent = r.myPrediction
      ? { target: r.resolve_at, start: r.lock_at, label: 'Result in' }
      : { target: r.lock_at, start: r.open_at, label: 'Locks in' }
    const time = new Date(candidate.target).getTime()
    if (time > Date.now() && (!best || time < best.time)) {
      best = { ...candidate, time }
    }
  }
  return best
}

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function CountdownView({ rounds }: { rounds: RoundDto[] | null }) {
  const event = getNextEvent(rounds)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!event) {
    return (
      <div className="hero-panel-stat">
        <span className="hero-panel-icon">🗳️</span>
        <div className="hero-panel-sub">No active votes</div>
      </div>
    )
  }

  const remaining = new Date(event.target).getTime() - now
  const total = new Date(event.target).getTime() - new Date(event.start).getTime()
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const urgent = remaining > 0 && remaining < 5 * MIN

  return (
    <div className={`hero-countdown ${urgent ? 'urgent' : ''}`}>
      <svg viewBox="0 0 64 64">
        <circle className="ring-track" cx="32" cy="32" r={RADIUS} />
        <circle
          className="ring-fill"
          cx="32"
          cy="32"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <div className="hero-countdown-center">
        <div className="hero-countdown-value">{formatRingValue(remaining)}</div>
      </div>
      <div className="hero-countdown-label">{event.label}</div>
    </div>
  )
}

export default function HeroPanel({
  view,
  rounds,
  tickets,
  streak,
  streakMultiplier,
}: {
  view: HeroPanelView
  rounds: RoundDto[] | null
  tickets: number | null
  streak: number
  streakMultiplier: number
}) {
  if (view === 'tickets') {
    return (
      <div className="hero-panel-stat hero-panel-pop">
        <span className="hero-panel-icon">🎟️</span>
        <div className="hero-panel-value">{tickets ?? '—'}</div>
        <div className="hero-panel-sub">votes left today</div>
      </div>
    )
  }

  if (view === 'boost') {
    return (
      <div className="hero-panel-stat hero-panel-pop boost-pop">
        <span className="hero-panel-icon flame-icon">🔥</span>
        <div className="hero-panel-value boost-value">{streakMultiplier.toFixed(1)}x</div>
        <div className="hero-panel-sub">{streak}-day streak boost</div>
      </div>
    )
  }

  if (view === 'markets') {
    const main = rounds?.filter((r) => r.kind === 'main_daily').length ?? 0
    const hourly = rounds?.filter((r) => r.kind === 'hourly').length ?? 0
    return (
      <div className="hero-panel-stat hero-panel-pop">
        <span className="hero-panel-icon">📊</span>
        <div className="hero-panel-value">{rounds?.length ?? '—'}</div>
        <div className="hero-panel-sub">{main} main · {hourly} hourly</div>
      </div>
    )
  }

  return <CountdownView rounds={rounds} />
}
