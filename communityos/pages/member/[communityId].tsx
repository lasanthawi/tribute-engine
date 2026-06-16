import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { api, MemberProfileDto } from '@/lib/api-client'
import { haptic, hapticNotify, initTelegramShell } from '@/lib/telegram-webapp'

export default function MemberProfile() {
  const router = useRouter()
  const { communityId } = router.query
  const [data, setData] = useState<MemberProfileDto | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    initTelegramShell()
    if (!communityId) return
    api.getMemberProfile(communityId as string).then(setData).catch(() => setData(null))
  }, [communityId])

  const copyReferral = async () => {
    if (!data?.referralLink) return
    haptic('light')
    try {
      await navigator.clipboard.writeText(data.referralLink)
      setCopied(true)
      hapticNotify('success')
      setTimeout(() => setCopied(false), 1400)
    } catch {
      hapticNotify('error')
    }
  }

  const progress = data ? Math.min(100, Math.round((data.member.xp % 120) / 1.2)) : 0

  return (
    <>
      <Head>
        <title>{data ? `${data.community.name} - Member` : 'CommunityOS Member'}</title>
      </Head>
      <main className="mini-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">CO</span>
            <div>
              <p className="eyebrow">Member profile</p>
              <h1 className="title">{data?.community.name ?? 'CommunityOS'}</h1>
            </div>
          </div>
        </header>

        {!data && <div className="empty">Loading member profile...</div>}

        {data && (
          <div className="stack">
            <section className="member-card">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">@{data.member.username}</h2>
                  <p className="panel-subtitle">{data.member.planName ?? 'No plan'} - {data.member.subscriptionStatus}</p>
                </div>
                <span className={`status-pill ${data.member.accessStatus}`}>{data.member.accessStatus}</span>
              </div>
              <div className="summary-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
                <div>
                  <div className="summary-label">XP</div>
                  <div className="summary-value">{data.member.xp}</div>
                </div>
                <div>
                  <div className="summary-label">Level</div>
                  <div className="summary-value">{data.member.level}</div>
                </div>
              </div>
              <div className="progress-bar" aria-label="Level progress">
                <span style={{ width: `${progress}%` }} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Referral link</h2>
                  <p className="panel-subtitle">Invite members and earn community XP when they activate.</p>
                </div>
              </div>
              <div className="member-card" style={{ boxShadow: 'none', marginBottom: 10 }}>
                <div className="truncate">{data.referralLink ?? 'Set TELEGRAM_BOT_USERNAME to generate links'}</div>
              </div>
              <button className="btn btn-primary" onClick={copyReferral} disabled={!data.referralLink}>
                {copied ? 'Copied' : 'Copy invite'}
              </button>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Rewards</h2>
                  <p className="panel-subtitle">Badges, perks, and unlocks from community activity.</p>
                </div>
              </div>
              <div className="stack">
                {data.rewards.map((reward) => (
                  <div className="member-card" key={reward.id}>
                    <div className="panel-header" style={{ marginBottom: 4 }}>
                      <strong>{reward.title}</strong>
                      <span className={`status-pill ${reward.claimed ? 'granted' : ''}`}>{reward.claimed ? 'claimed' : reward.type}</span>
                    </div>
                    <div className="summary-note">{reward.description}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Recent activity</h2>
                  <p className="panel-subtitle">Your member journey across this community.</p>
                </div>
              </div>
              <div className="stack">
                {data.activity.map((event) => (
                  <div className="member-card" key={event.id}>
                    <strong>{event.title}</strong>
                    <div className="summary-note">{new Date(event.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        <nav className="bottom-nav">
          <Link className="active" href={`/member/${communityId ?? 1}`}>
            Profile
          </Link>
          <a href="#rewards">Rewards</a>
          <button className="btn-ghost" style={{ border: 0, color: 'var(--muted)' }} onClick={copyReferral}>
            Invite
          </button>
          <Link href={`/community/${communityId ?? 1}`}>Admin</Link>
        </nav>
      </main>
    </>
  )
}
