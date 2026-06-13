import { useEffect, useState } from 'react'
import Head from 'next/head'
import BottomNav from '@/components/ui/BottomNav'
import LeagueBadge from '@/components/ui/LeagueBadge'
import { api, ProfileDto } from '@/lib/api-client'

export default function Profile() {
  const [profile, setProfile] = useState<ProfileDto | null>(null)

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [])

  return (
    <>
      <Head>
        <title>Profile · VOTE LEAGUE</title>
      </Head>
      <div className="screen">
        <div className="topbar">
          <div className="brand">
            <span className="brand-wordmark">{profile?.username ? `@${profile.username}` : 'Profile'}</span>
          </div>
        </div>

        {profile === null && <div className="skeleton" style={{ height: 200, marginBottom: 12 }} />}

        {profile && (
          <>
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="stat-tile-icon">🗳️</span>
                <span className="stat-tile-value">{profile.totalVotes}</span>
                <span className="stat-tile-label">Total Votes</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon">🎯</span>
                <span className="stat-tile-value">{profile.accuracy}%</span>
                <span className="stat-tile-label">Accuracy</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon">🔥</span>
                <span className="stat-tile-value">{profile.bestStreak}d</span>
                <span className="stat-tile-label">Best Streak</span>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <LeagueBadge points={profile.points} />
            </div>

            <div className="section-title">🏆 Achievements</div>
            <div className="achievement-grid">
              {profile.achievements.map((a) => (
                <div key={a.code} className={`achievement-card ${a.unlocked ? 'unlocked' : 'locked'}`}>
                  <div className="achievement-icon">{a.icon}</div>
                  <div className="achievement-title">{a.title}</div>
                  <div className="achievement-desc">{a.description}</div>
                  {!a.unlocked && a.target !== null && (
                    <div className="achievement-progress-track">
                      <div
                        className="achievement-progress-fill"
                        style={{ width: `${Math.min(100, Math.round(((a.progress ?? 0) / a.target) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </>
  )
}
