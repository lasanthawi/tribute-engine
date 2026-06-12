import RoundTimer from './RoundTimer'
import { RoundDto } from '@/lib/api-client'

const ASSET_ICON: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  TON: '◆',
}

const ASSET_NAME: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  TON: 'Toncoin',
}

export default function AssetCard({
  round,
  onPredict,
}: {
  round: RoundDto
  onPredict: (round: RoundDto, side: 'UP' | 'DOWN') => void
}) {
  const isMain = round.kind === 'main_daily'

  return (
    <div className="asset-card">
      <div className="asset-card-head">
        <div className="asset-id">
          <div className={`asset-icon ${round.asset}`}>{ASSET_ICON[round.asset]}</div>
          <div>
            <div className="asset-name">{ASSET_NAME[round.asset]}</div>
            <div className={`asset-kind ${round.kind}`}>{isMain ? '⭐ Main Vote' : 'Hourly'}</div>
          </div>
        </div>
        <RoundTimer target={round.lock_at} start={round.open_at} label="Locks in" />
      </div>

      <div className="reward-row">
        Cast your vote: will {round.asset} be UP or DOWN? Correct call wins{' '}
        <b>{round.base_reward} pts</b>
        {isMain ? ' + streak bonus' : ''}.
      </div>

      {round.myPrediction ? (
        <div className={`locked-badge ${round.myPrediction.side === 'UP' ? 'up' : 'down'}`}>
          🔒 You voted {round.myPrediction.side}
          {round.myPrediction.confidence > 0 ? ` · ${round.myPrediction.confidence} pts staked` : ''}
        </div>
      ) : (
        <div className="updown-row">
          <button className="updown-btn up" onClick={() => onPredict(round, 'UP')}>
            <span className="updown-arrow">▲</span>
            <span>UP</span>
            <span className="updown-sub">Price rises</span>
          </button>
          <button className="updown-btn down" onClick={() => onPredict(round, 'DOWN')}>
            <span className="updown-arrow">▼</span>
            <span>DOWN</span>
            <span className="updown-sub">Price falls</span>
          </button>
        </div>
      )}
    </div>
  )
}
