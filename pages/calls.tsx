import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import Logo from '@/components/ui/Logo'
import CoinIcon from '@/components/ui/CoinIcon'
import { api, CallDto } from '@/lib/api-client'
import { getTelegramWebApp, haptic } from '@/lib/telegram-webapp'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  return n >= 100 ? n.toFixed(2) : n.toFixed(4)
}

function CallCard({ call, referralLink }: { call: CallDto; referralLink: string | null }) {
  const round = call.round
  const isPending = !round || (round.state !== 'SETTLED' && round.state !== 'VOIDED')
  const isVoid = round?.state === 'VOIDED'

  let badge = '⏳'
  let resultLabel = 'Pending'
  let deltaClass = 'neutral'
  let deltaText = ''

  if (isVoid) {
    badge = '⟳'
    resultLabel = 'Void · refunded'
    deltaText = '0'
  } else if (call.isCorrect === true) {
    badge = '✅'
    resultLabel = 'Correct'
    deltaClass = 'positive'
    deltaText = `+${call.pointsEarned ?? 0}`
  } else if (call.isCorrect === false) {
    badge = '❌'
    resultLabel = 'Missed'
    deltaClass = 'negative'
    deltaText = call.confidence > 0 ? `-${call.confidence}` : '0'
  }

  const handleShare = () => {
    haptic('light')
    const text = `I voted ${call.side} on ${round.asset} on VOTE LEAGUE 🗳️ — and I called it right! Think you can beat my streak?`
    const tg = getTelegramWebApp()
    const url = referralLink || ''
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(text, ['users', 'groups'])
    } else if (typeof window !== 'undefined') {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
      window.open(shareUrl, '_blank')
    }
  }

  return (
    <div className="call-card">
      <div className="call-left">
        <div className="asset-icon">
          <CoinIcon asset={round.asset} size={32} />
        </div>
        <div className="call-meta">
          <div className="call-title">
            {round.asset} <span className={`call-side ${call.side}`}>{call.side === 'UP' ? '▲' : '▼'} {call.side}</span>
          </div>
          <div className="call-sub">
            {round.kind === 'main_daily' ? 'Main Call' : 'Hourly'}
            {round.strike != null ? ` · strike ${formatPrice(round.strike)}` : ''}
            {round.close != null ? ` → ${formatPrice(round.close)}` : ''}
            {call.confidence > 0 ? ` · ${call.confidence} pts staked` : ''}
          </div>
        </div>
      </div>
      <div className="call-result">
        <span className="outcome-badge">{badge}</span>
        {isPending ? (
          <span className="call-sub">{resultLabel}</span>
        ) : (
          <span className={`points-delta ${deltaClass}`}>{deltaText} pts</span>
        )}
        {call.isCorrect === true && (
          <button className="share-btn" onClick={handleShare}>
            Share win
          </button>
        )}
      </div>
    </div>
  )
}

export default function Calls() {
  const [data, setData] = useState<{ pending: CallDto[]; settled: CallDto[] } | null>(null)
  const [tab, setTab] = useState<'pending' | 'settled'>('pending')
  const [referralLink, setReferralLink] = useState<string | null>(null)

  useEffect(() => {
    api.getCalls().then(setData).catch(() => setData({ pending: [], settled: [] }))
    api
      .getReferralInfo()
      .then((r) => setReferralLink(r.link))
      .catch(() => {})
  }, [])

  const list = tab === 'pending' ? data?.pending : data?.settled

  return (
    <>
      <Head>
        <title>My Votes · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-dot"><Logo size={26} /></span> My Votes
          </div>
        </div>

        <div className="tab-row">
          <button className={`tab-btn ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
            Pending {data ? `(${data.pending.length})` : ''}
          </button>
          <button className={`tab-btn ${tab === 'settled' ? 'active' : ''}`} onClick={() => setTab('settled')}>
            Settled {data ? `(${data.settled.length})` : ''}
          </button>
        </div>

        {data === null && (
          <>
            <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 76, marginBottom: 10 }} />
          </>
        )}

        {data !== null && (!list || list.length === 0) && (
          <div className="empty-state">
            {tab === 'pending'
              ? 'No pending votes. Head to Home and cast your first vote!'
              : 'No settled votes yet — check back after the next reveal.'}
          </div>
        )}

        {list?.map((call) => (
          <CallCard key={call.id} call={call} referralLink={referralLink} />
        ))}
      </div>
      <BottomNav />
    </>
  )
}
