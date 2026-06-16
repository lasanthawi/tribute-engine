import Head from 'next/head'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api, DashboardDto, MemberRowDto, money, PlanDto, RewardDto } from '@/lib/api-client'
import { demoDashboard } from '@/lib/demo-data'
import { haptic, initTelegramShell } from '@/lib/telegram-webapp'

type TabKey = 'home' | 'members' | 'access' | 'growth' | 'rewards'
type Mode = 'owner' | 'member'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'members', label: 'Members' },
  { key: 'access', label: 'Access' },
  { key: 'growth', label: 'Growth' },
  { key: 'rewards', label: 'Rewards' },
]

function dateShort(iso: string | null) {
  if (!iso) return 'No activity'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('owner')
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [data, setData] = useState<DashboardDto | null>(null)
  const [preview, setPreview] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [planName, setPlanName] = useState('Inner Circle')
  const [planPrice, setPlanPrice] = useState('29')
  const [rewardTitle, setRewardTitle] = useState('Top Contributor')

  useEffect(() => {
    initTelegramShell()
    api
      .getDashboard(1)
      .then((dashboard) => {
        setData(dashboard)
        setPreview(false)
      })
      .catch(() => {
        setData(demoDashboard)
        setPreview(true)
      })
  }, [])

  const member = data?.members[1] ?? data?.members[0]
  const pendingMembers = useMemo(
    () => data?.members.filter((row) => row.accessStatus === 'pending' || row.accessStatus === 'failed') ?? [],
    [data]
  )

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 1800)
  }

  function setTab(tab: TabKey) {
    haptic('light')
    setActiveTab(tab)
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault()
    if (!data || !planName.trim()) return

    const draft: PlanDto = {
      id: Date.now(),
      name: planName.trim(),
      description: 'New paid Telegram access plan',
      priceCents: Math.max(0, Math.round(Number(planPrice || 0) * 100)),
      currency: 'USD',
      interval: 'month',
      status: 'active',
      subscribers: 0,
    }

    setData({ ...data, plans: [draft, ...data.plans] })
    setPlanName('')
    showToast(preview ? 'Preview plan added' : 'Plan added')

    if (!preview) {
      api.createPlan(data.community.id, {
        name: draft.name,
        description: draft.description ?? undefined,
        priceCents: draft.priceCents,
        interval: draft.interval,
      }).catch(() => showToast('Plan saved locally, API failed'))
    }
  }

  function grantAccess(row: MemberRowDto) {
    if (!data) return
    setData({
      ...data,
      members: data.members.map((memberRow) =>
        memberRow.id === row.id ? { ...memberRow, accessStatus: 'granted', lastActiveAt: new Date().toISOString() } : memberRow
      ),
      accessLogs: [
        {
          id: Date.now(),
          action: 'grant',
          status: 'success',
          message: `Access granted to @${row.username}`,
          createdAt: new Date().toISOString(),
        },
        ...data.accessLogs,
      ],
      metrics: { ...data.metrics, accessIssues: Math.max(0, data.metrics.accessIssues - 1) },
    })
    showToast(`Access granted to @${row.username}`)
  }

  function addReward(event: FormEvent) {
    event.preventDefault()
    if (!data || !rewardTitle.trim()) return
    const reward: RewardDto = {
      id: Date.now(),
      type: 'badge',
      title: rewardTitle.trim(),
      description: 'Manual badge for community contribution',
      claimed: false,
    }
    setData({ ...data, rewards: [reward, ...data.rewards] })
    setRewardTitle('')
    showToast('Reward created')
  }

  return (
    <>
      <Head>
        <title>CommunityOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <main className="tg-shell">
        {data && (
          <>
            <header className="tg-header">
              <div className="community-chip">
                <span className="community-avatar">{initials(data.community.name)}</span>
                <div className="community-copy">
                  <span className="community-label">{preview ? 'Preview workspace' : 'Telegram workspace'}</span>
                  <strong>{data.community.name}</strong>
                </div>
              </div>
              <button className="icon-button" type="button" onClick={() => showToast('Settings panel coming next')}>
                Set
              </button>
            </header>

            <section className="hero-card">
              <div>
                <p className="overline">Community operating system</p>
                <h1>{mode === 'owner' ? 'Run your Telegram community from one place.' : 'Your member home base.'}</h1>
                <p className="hero-copy">
                  {mode === 'owner'
                    ? 'Memberships, CRM, access, referrals, rewards, and community health in a Mini App made for Telegram.'
                    : 'Track your access, rewards, referrals, and activity without leaving Telegram.'}
                </p>
              </div>
              <div className="mode-switch" aria-label="View mode">
                <button className={mode === 'owner' ? 'selected' : ''} type="button" onClick={() => setMode('owner')}>
                  Owner
                </button>
                <button className={mode === 'member' ? 'selected' : ''} type="button" onClick={() => setMode('member')}>
                  Member
                </button>
              </div>
            </section>

            {mode === 'owner' ? (
              <>
                {activeTab === 'home' && (
                  <section className="screen-stack">
                    <div className="metric-strip">
                      <Metric label="Members" value={String(data.metrics.members)} note={`${data.metrics.activeSubscriptions} paid`} />
                      <Metric label="Revenue" value={money(data.metrics.monthlyRevenueCents)} note="This month" />
                      <Metric label="Access" value={String(pendingMembers.length)} note="Need action" tone={pendingMembers.length ? 'warn' : 'ok'} />
                    </div>
                    <div className="section-card">
                      <div className="section-head">
                        <div>
                          <p className="overline">Today</p>
                          <h2>Command center</h2>
                        </div>
                        <button className="tiny-action" type="button" onClick={() => setTab('access')}>
                          Review
                        </button>
                      </div>
                      <div className="action-grid">
                        <Action title="Grant access" detail={`${pendingMembers.length} pending members`} onClick={() => setTab('access')} />
                        <Action title="Add paid plan" detail={`${data.plans.length} plans live`} onClick={() => setTab('access')} />
                        <Action title="Reward members" detail={`${data.rewards.length} rewards`} onClick={() => setTab('rewards')} />
                        <Action title="Grow referrals" detail={`${data.metrics.referralActivations} activations`} onClick={() => setTab('growth')} />
                      </div>
                    </div>
                    <div className="section-card">
                      <div className="section-head">
                        <div>
                          <p className="overline">Community health</p>
                          <h2>Signals</h2>
                        </div>
                      </div>
                      <div className="signal-list">
                        {data.activity.slice(0, 3).map((event) => (
                          <div className="signal-row" key={event.id}>
                            <span className="signal-dot" />
                            <div>
                              <strong>{event.title}</strong>
                              <p>{event.eventType}</p>
                            </div>
                            <span>{dateShort(event.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {activeTab === 'members' && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <p className="overline">CRM</p>
                        <h2>Members</h2>
                      </div>
                      <span className="count-pill">{data.members.length}</span>
                    </div>
                    <div className="member-list">
                      {data.members.map((row) => (
                        <MemberCard key={row.id} member={row} onGrant={() => grantAccess(row)} />
                      ))}
                    </div>
                  </section>
                )}

                {activeTab === 'access' && (
                  <section className="screen-stack">
                    <div className="section-card">
                      <div className="section-head">
                        <div>
                          <p className="overline">Memberships</p>
                          <h2>Plans and access</h2>
                        </div>
                      </div>
                      <form className="compact-form" onSubmit={createPlan}>
                        <input value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Plan name" />
                        <input value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} inputMode="decimal" placeholder="Price" />
                        <button type="submit">Add</button>
                      </form>
                      <div className="plan-list">
                        {data.plans.map((plan) => (
                          <div className="plan-row" key={plan.id}>
                            <div>
                              <strong>{plan.name}</strong>
                              <p>{plan.description ?? `${plan.interval} membership`}</p>
                            </div>
                            <div className="plan-price">
                              <strong>{money(plan.priceCents, plan.currency)}</strong>
                              <span>{plan.subscribers} members</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="section-card">
                      <div className="section-head">
                        <div>
                          <p className="overline">Queue</p>
                          <h2>Access requests</h2>
                        </div>
                      </div>
                      {pendingMembers.length > 0 ? (
                        <div className="member-list">
                          {pendingMembers.map((row) => (
                            <MemberCard key={row.id} member={row} onGrant={() => grantAccess(row)} />
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">
                          <strong>No pending access requests</strong>
                          <p>New paid members and imported members will appear here before they are granted Telegram access.</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {activeTab === 'growth' && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <p className="overline">Referral engine</p>
                        <h2>Growth loops</h2>
                      </div>
                      <span className="count-pill">{data.metrics.referralActivations} activated</span>
                    </div>
                    <div className="referral-card">
                      <strong>Invite 3 friends, unlock bonus content</strong>
                      <p>CommunityOS tracks invite clicks, joins, activations, and paid conversion per community.</p>
                      <button type="button" onClick={() => showToast('Invite campaign created')}>
                        Create campaign
                      </button>
                    </div>
                    <div className="signal-list">
                      {data.referrals.map((referral) => (
                        <div className="signal-row" key={referral.id}>
                          <span className="signal-dot" />
                          <div>
                            <strong>@{referral.referrer}</strong>
                            <p>{referral.referralCode}</p>
                          </div>
                          <span>{referral.clicks} clicks</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {activeTab === 'rewards' && (
                  <section className="section-card">
                    <div className="section-head">
                      <div>
                        <p className="overline">Rewards</p>
                        <h2>XP and badges</h2>
                      </div>
                      <span className="count-pill">{data.metrics.xpIssued} XP</span>
                    </div>
                    <form className="compact-form one-line" onSubmit={addReward}>
                      <input value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} placeholder="Reward title" />
                      <button type="submit">Create</button>
                    </form>
                    <div className="reward-grid">
                      {data.rewards.map((reward) => (
                        <div className="reward-tile" key={reward.id}>
                          <span>{reward.type}</span>
                          <strong>{reward.title}</strong>
                          <p>{reward.description}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <MemberHome data={data} member={member} onToast={showToast} />
            )}
          </>
        )}

        {!data && (
          <div className="loading-screen">
            <span className="community-avatar">CO</span>
            <strong>Loading CommunityOS</strong>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}

        {mode === 'owner' && (
          <nav className="tg-tabbar" aria-label="CommunityOS sections">
            {tabs.map((tab) => (
              <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} type="button" onClick={() => setTab(tab.key)}>
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </main>
    </>
  )
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`metric-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  )
}

function Action({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button className="action-card" type="button" onClick={onClick}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  )
}

function MemberCard({ member, onGrant }: { member: MemberRowDto; onGrant: () => void }) {
  const needsAccess = member.accessStatus === 'pending' || member.accessStatus === 'failed'

  return (
    <article className="member-row-card">
      <span className="member-avatar">{initials(member.username)}</span>
      <div className="member-main">
        <div className="member-line">
          <strong>@{member.username}</strong>
          <span className={`state-badge ${member.accessStatus}`}>{member.accessStatus}</span>
        </div>
        <p>
          {member.planName ?? 'No plan'} - {member.subscriptionStatus} - {member.xp} XP
        </p>
      </div>
      {needsAccess ? (
        <button className="mini-button" type="button" onClick={onGrant}>
          Grant
        </button>
      ) : (
        <span className="mini-label">L{member.level}</span>
      )}
    </article>
  )
}

function MemberHome({
  data,
  member,
  onToast,
}: {
  data: DashboardDto
  member: MemberRowDto | undefined
  onToast: (message: string) => void
}) {
  const progress = member ? Math.min(100, Math.round((member.xp % 120) / 1.2)) : 0

  return (
    <section className="screen-stack">
      <div className="member-hero">
        <div>
          <p className="overline">Member profile</p>
          <h2>@{member?.username ?? 'member'}</h2>
          <p>{member?.planName ?? 'Community member'} access is {member?.accessStatus ?? 'pending'}.</p>
        </div>
        <span className="level-orb">L{member?.level ?? 1}</span>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="overline">Progress</p>
            <h2>{member?.xp ?? 0} XP earned</h2>
          </div>
          <span className="count-pill">{progress}%</span>
        </div>
        <div className="progress-rail">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="overline">Invite loop</p>
            <h2>Bring useful members</h2>
          </div>
        </div>
        <div className="referral-card">
          <strong>Invite 3 members to unlock bonus content.</strong>
          <p>Your referral link activates once a friend joins and participates.</p>
          <button type="button" onClick={() => onToast('Invite link copied in preview')}>
            Copy invite
          </button>
        </div>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div>
            <p className="overline">Rewards</p>
            <h2>Available perks</h2>
          </div>
        </div>
        <div className="reward-grid">
          {data.rewards.map((reward) => (
            <div className="reward-tile" key={reward.id}>
              <span>{reward.claimed ? 'claimed' : reward.type}</span>
              <strong>{reward.title}</strong>
              <p>{reward.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="member-bottom-space" />
    </section>
  )
}
