import { useEffect, useState } from 'react'

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RoundTimer({ target, label }: { target: string; label: string }) {
  const [remaining, setRemaining] = useState(() => new Date(target).getTime() - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(target).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [target])

  const urgent = remaining > 0 && remaining < 5 * 60 * 1000

  return (
    <div className="round-timer">
      <div className="round-timer-label">{label}</div>
      <div className={`round-timer-value ${urgent ? 'urgent' : ''}`}>{formatRemaining(remaining)}</div>
    </div>
  )
}
