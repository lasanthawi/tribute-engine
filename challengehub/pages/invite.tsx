import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import { api, ReferralInfoDto } from '@/lib/api-client'
import { getTelegramWebApp, haptic, hapticNotify } from '@/lib/telegram-webapp'

export default function Invite() {
  const [data, setData] = useState<ReferralInfoDto | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.getReferralInfo().then(setData).catch(() => setData(null))
  }, [])

  const link = data?.link

  const handleCopy = async () => {
    if (!link) return
    haptic('light')
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      hapticNotify('success')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const handleShare = () => {
    if (!link) return
    haptic('medium')
    const text = 'ChallengeHub 🏆 — join community challenges, complete daily tasks, and earn XP. Beat me on the leaderboard 👇'
    const tg = getTelegramWebApp()
    if (tg?.switchInlineQuery) {
      tg.switchInlineQuery(text, ['users', 'groups'])
    } else if (typeof window !== 'undefined') {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
      window.open(shareUrl, '_blank')
    }
  }

  return (
    <>
      <Head>
        <title>Invite · ChallengeHub</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">🔗 Invite</div>
        </div>

        <div className="invite-card">
          <div className="invite-emoji">🎉</div>
          <h2 className="invite-title">Invite friends, earn XP</h2>
          <p className="invite-subtitle">
            Earn <b style={{ color: 'var(--gold)' }}>50 XP</b> when your friend completes their first check-in.
          </p>

          {data === null ? (
            <div className="skeleton" style={{ height: 40, marginBottom: 14 }} />
          ) : (
            <div className="invite-link-box">
              <span className="invite-link-text">{link ?? 'Link unavailable'}</span>
            </div>
          )}

          <button className="btn-primary" onClick={handleShare} disabled={!link} style={{ marginBottom: 10 }}>
            Share invite 🚀
          </button>
          <button className="btn-ghost" onClick={handleCopy} disabled={!link}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>

        <div className="invite-stats">
          <div className="invite-stat">
            <div className="invite-stat-value">{data?.activatedCount ?? '—'}</div>
            <div className="invite-stat-label">Activated</div>
          </div>
          <div className="invite-stat">
            <div className="invite-stat-value">{data?.xpFromInvites ?? '—'}</div>
            <div className="invite-stat-label">XP from invites</div>
          </div>
        </div>

        <div className="invite-rules">
          <b>How it works</b>
          <br />
          1. Share your link — friends join via your bot start link.
          <br />
          2. Once they complete their <b>first daily check-in</b>, your referral activates and you get{' '}
          <b>+50 XP</b>.
          {data && data.pendingCount > 0 && (
            <>
              <br />
              <br />
              You have <b>{data.pendingCount}</b> pending invite{data.pendingCount === 1 ? '' : 's'} waiting on
              their first check-in.
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  )
}
