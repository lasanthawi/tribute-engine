import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import XpBadge from '@/components/ui/XpBadge'
import XpRing from '@/components/ui/XpRing'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { api, MeDto, RewardDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

const REWARD_ICONS: Record<string, string> = {
  badge: '🎖️',
  certificate: '📜',
  digital_product: '🎁',
  premium_access: '✨',
  cash: '💰',
  sponsor: '🤝',
}

export default function Profile() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [rewards, setRewards] = useState<RewardDto[] | null>(null)
  const [claiming, setClaiming] = useState<number | null>(null)

  const refresh = () => {
    api.getMe().then(setMe).catch(() => setMe(null))
    api
      .getRewards()
      .then((data) => setRewards(data.rewards))
      .catch(() => setRewards([]))
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleClaim = async (reward: RewardDto) => {
    haptic('medium')
    setClaiming(reward.id)
    try {
      await api.claimReward(reward.id)
      hapticNotify('success')
      refresh()
    } catch {
      hapticNotify('error')
    } finally {
      setClaiming(null)
    }
  }

  return (
    <>
      <Head>
        <title>Profile · ChallengeHub</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-wordmark">{me?.username ? `@${me.username}` : 'Profile'}</span>
          </div>
        </div>

        {me === null && <div className="skeleton" style={{ height: 80, marginBottom: 16 }} />}

        {me && (
          <>
            <div className="profile-hero">
              <div className="profile-avatar">{(me.username ?? '?').slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-name">{me.username ? `@${me.username}` : 'Anonymous'}</div>
                <div className="profile-sub">{me.xp.toLocaleString()} XP total</div>
              </div>
              <XpRing xp={me.xp} level={me.level} size={64} progressColor="var(--accent)" trackColor="var(--border)" textColor="var(--text)" />
            </div>

            <div style={{ marginBottom: 18 }}>
              <XpBadge xp={me.xp} level={me.level} />
            </div>

            <div className="stat-grid">
              <div className="stat-tile">
                <span className="stat-tile-icon">🏁</span>
                <span className="stat-tile-value">{me.activeChallenges.length}</span>
                <span className="stat-tile-label">Active Challenges</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon">⭐</span>
                <span className="stat-tile-value">{me.level}</span>
                <span className="stat-tile-label">Level</span>
              </div>
            </div>

            {me.activeChallenges.length > 0 && (
              <>
                <div className="section-title">Active Challenges</div>
                {me.activeChallenges.map((c) => (
                  <div key={c.id} className="task-item">
                    <CategoryBadge category={c.category} size={36} />
                    <div className="task-item-body">
                      <div className="task-item-title">{c.title}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        <div className="section-title">🎁 Rewards</div>
        {rewards === null && <div className="skeleton" style={{ height: 60, marginBottom: 10 }} />}
        {rewards !== null && rewards.length === 0 && (
          <div className="empty-state">
            <div className="empty-emoji">🎁</div>
            No rewards available yet.
          </div>
        )}
        {rewards?.map((reward) => (
          <div key={reward.id} className={`reward-card ${reward.claimed ? 'claimed' : ''}`}>
            <div className="reward-icon">{REWARD_ICONS[reward.type] ?? '🏆'}</div>
            <div className="reward-info">
              <div className="reward-title">{reward.title}</div>
              {reward.description && <div className="reward-desc">{reward.description}</div>}
            </div>
            {reward.claimed ? (
              <span className="task-item-check">✓</span>
            ) : (
              <button
                className="btn-primary reward-claim-btn"
                disabled={claiming === reward.id}
                onClick={() => handleClaim(reward)}
              >
                Claim
              </button>
            )}
          </div>
        ))}
      </div>
      <BottomNav />
    </>
  )
}
