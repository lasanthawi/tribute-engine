import { useState } from 'react'
import { RoundDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

const ASSET_NAME: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  TON: 'Toncoin',
}

export default function PredictModal({
  round,
  initialSide,
  maxStake,
  onConfirm,
  onClose,
}: {
  round: RoundDto
  initialSide: 'UP' | 'DOWN'
  maxStake: number
  onConfirm: (side: 'UP' | 'DOWN', confidence: number) => Promise<void>
  onClose: () => void
}) {
  const [side, setSide] = useState<'UP' | 'DOWN'>(initialSide)
  const [confidence, setConfidence] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cap = Math.min(500, maxStake)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(side, confidence)
      hapticNotify('success')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      hapticNotify('error')
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">
          {ASSET_NAME[round.asset]} · {round.kind === 'main_daily' ? 'Main Call' : 'Hourly Call'}
        </h3>
        <p className="sheet-subtitle">Pick a side. One tap, locked until resolve.</p>

        <div className="sheet-side-row">
          <button
            className={`updown-btn up ${side === 'UP' ? 'selected' : ''}`}
            onClick={() => {
              haptic('light')
              setSide('UP')
            }}
          >
            <span className="updown-arrow">▲</span>
            <span>UP</span>
          </button>
          <button
            className={`updown-btn down ${side === 'DOWN' ? 'selected' : ''}`}
            onClick={() => {
              haptic('light')
              setSide('DOWN')
            }}
          >
            <span className="updown-arrow">▼</span>
            <span>DOWN</span>
          </button>
        </div>

        <div className="confidence-block">
          <div className="confidence-label-row">
            <span>Confidence stake</span>
            <span className="confidence-value">{confidence} pts</span>
          </div>
          <input
            type="range"
            className="confidence-slider"
            min={0}
            max={cap}
            step={10}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          />
          <div className="confidence-label-row" style={{ marginTop: 6, fontSize: 11 }}>
            <span>Stake more, win 2x back if right (max {cap})</span>
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--down)', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{error}</p>
        )}

        <button className={`btn-primary ${side === 'UP' ? 'up' : 'down'}`} onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Locking in…' : `Call ${side} 🎯`}
        </button>
      </div>
    </div>
  )
}
