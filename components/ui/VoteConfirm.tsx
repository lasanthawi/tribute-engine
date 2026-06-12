import { useEffect } from 'react'

const ASSET_NAME: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  TON: 'Toncoin',
}

export default function VoteConfirm({
  asset,
  side,
  onDone,
}: {
  asset: 'BTC' | 'ETH' | 'TON'
  side: 'UP' | 'DOWN'
  onDone: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="vote-confirm-backdrop">
      <div className={`vote-confirm-card ${side === 'UP' ? 'up' : 'down'}`}>
        <div className="vote-confirm-icon">
          <svg viewBox="0 0 52 52">
            <circle className="vote-confirm-ring" cx="26" cy="26" r="23" />
            <path className="vote-confirm-check" d="M14 27 L22.5 35.5 L39 18" />
          </svg>
        </div>
        <div className="vote-confirm-title">Vote locked in 🔒</div>
        <div className="vote-confirm-sub">
          {ASSET_NAME[asset]} · {side === 'UP' ? '▲ UP' : '▼ DOWN'}
        </div>
      </div>
    </div>
  )
}
