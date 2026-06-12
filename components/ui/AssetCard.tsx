import RoundTimer from './RoundTimer'
import CoinIcon from './CoinIcon'
import { RoundDto } from '@/lib/api-client'

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
  const { up, down, total } = round.sentiment
  const upPct = total > 0 ? Math.round((up / total) * 100) : 50
  const downPct = 100 - upPct
  const isTrending = total >= 100

  return (
    <div className="asset-card" data-asset={round.asset}>
      <div className="asset-card-head">
        <div className="asset-id">
          <div className="asset-icon">
            <CoinIcon asset={round.asset} size={34} />
          </div>
          <div>
            <div className="asset-name">
              {ASSET_NAME[round.asset]}
              {isTrending && <span className="trending-badge">🔥 Trending</span>}
            </div>
            <div className={`asset-kind ${round.kind}`}>{isMain ? '⭐ Main Vote' : 'Hourly'}</div>
          </div>
        </div>
        {round.myPrediction ? (
          <RoundTimer target={round.resolve_at} start={round.open_at} label="Results in" />
        ) : (
          <RoundTimer target={round.lock_at} start={round.open_at} label="Locks in" />
        )}
      </div>

      <div className="reward-row">
        Cast your vote: will {round.asset} be UP or DOWN? Correct call wins{' '}
        <b>{round.base_reward} pts</b>
        {isMain ? ' + streak bonus' : ''}.
      </div>

      {total > 0 && (
        <div className="sentiment">
          <div className="sentiment-bar">
            <div className="sentiment-fill up" style={{ width: `${upPct}%` }} />
            <div className="sentiment-fill down" style={{ width: `${downPct}%` }} />
          </div>
          <div className="sentiment-labels">
            <span className="sentiment-label up">▲ {upPct}%</span>
            <span className="sentiment-total">{total.toLocaleString()} votes</span>
            <span className="sentiment-label down">{downPct}% ▼</span>
          </div>
        </div>
      )}

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
