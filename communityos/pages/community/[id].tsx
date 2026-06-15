import Head from 'next/head'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { api, DashboardDto, money } from '@/lib/api-client'
import { initTelegramShell } from '@/lib/telegram-webapp'

function dateShort(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function CommunityDashboard() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState<DashboardDto | null>(null)
  const [planName, setPlanName] = useState('')
  const [planPrice, setPlanPrice] = useState('29')
  const [savingPlan, setSavingPlan] = useState(false)

  const refresh = () => {
    if (!id) return
    api.getDashboard(id as string).then(setData).catch(() => setData(null))
  }

  useEffect(() => {
    initTelegramShell()
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const createPlan = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || !planName.trim()) return
    setSavingPlan(true)
    try {
      await api.createPlan(id as string, {
        name: planName.trim(),
        priceCents: Math.max(0, Math.round(Number(planPrice || 0) * 100)),
        interval: 'month',
      })
      setPlanName('')
      refresh()
    } finally {
      setSavingPlan(false)
    }
  }

  return (
    <>
      <Head>
        <title>{data ? `${data.community.name} - CommunityOS` : 'CommunityOS'}</title>
      </Head>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <Link href="/" className="brand-mark" aria-label="Back to home">
              CO
            </Link>
            <div>
              <p className="eyebrow">Owner dashboard</p>
              <h1 className="title">{data?.community.name ?? 'CommunityOS'}</h1>
            </div>
          </div>
          <Link className="btn" href={`/member/${id ?? 1}`}>
            Member view
          </Link>
        </header>

        {!data && <div className="empty">Loading dashboard...</div>}

        {data && (
          <div className="layout-grid">
            <aside className="sidebar">
              <a className="nav-link active" href="#overview">
                Overview <span>{data.community.status}</span>
              </a>
              <a className="nav-link" href="#members">
                CRM <span>{data.metrics.members}</span>
              </a>
              <a className="nav-link" href="#plans">
                Plans <span>{data.plans.length}</span>
              </a>
              <a className="nav-link" href="#growth">
                Growth <span>{data.metrics.referralActivations}</span>
              </a>
              <a className="nav-link" href="#access">
                Access <span>{data.metrics.accessIssues}</span>
              </a>
            </aside>

            <div className="stack">
              <section id="overview" className="summary-grid">
                <div className="summary-card">
                  <div className="summary-label">Members</div>
                  <div className="summary-value">{data.metrics.members}</div>
                  <div className="summary-note">{data.metrics.activeSubscriptions} active subscriptions</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Monthly revenue</div>
                  <div className="summary-value">{money(data.metrics.monthlyRevenueCents)}</div>
                  <div className="summary-note">Manual and referral-attributed beta revenue</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Referral activations</div>
                  <div className="summary-value">{data.metrics.referralActivations}</div>
                  <div className="summary-note">Community-scoped growth loop</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">XP issued</div>
                  <div className="summary-value">{data.metrics.xpIssued}</div>
                  <div className="summary-note">{data.metrics.accessIssues} access issue(s)</div>
                </div>
              </section>

              <section className="table-panel" id="members">
                <div className="panel-header" style={{ padding: 14, marginBottom: 0 }}>
                  <div>
                    <h2 className="panel-title">Community CRM</h2>
                    <p className="panel-subtitle">Member state, subscription, source, XP, and access status.</p>
                  </div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Member</th>
                      <th>Subscription</th>
                      <th>Access</th>
                      <th>Source</th>
                      <th>XP</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <div className="truncate">@{member.username}</div>
                          <div className="summary-note">{member.role}</div>
                        </td>
                        <td>
                          <span className={`status-pill ${member.subscriptionStatus}`}>{member.subscriptionStatus}</span>
                          <div className="summary-note">{member.planName ?? 'No plan'}</div>
                        </td>
                        <td>
                          <span className={`status-pill ${member.accessStatus}`}>{member.accessStatus}</span>
                        </td>
                        <td>{member.source}</td>
                        <td>
                          <strong>{member.xp}</strong>
                          <div className="summary-note">Level {member.level}</div>
                        </td>
                        <td>{dateShort(member.lastActiveAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="panel" id="plans">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Membership plans</h2>
                    <p className="panel-subtitle">Paid groups, renewals, and access-control records start here.</p>
                  </div>
                </div>
                <div className="table-panel" style={{ marginBottom: 12 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Subscribers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.plans.map((plan) => (
                        <tr key={plan.id}>
                          <td>
                            <div className="truncate">{plan.name}</div>
                            <div className="summary-note">{plan.description ?? plan.interval}</div>
                          </td>
                          <td>{money(plan.priceCents, plan.currency)}</td>
                          <td>
                            <span className={`status-pill ${plan.status}`}>{plan.status}</span>
                          </td>
                          <td>{plan.subscribers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form className="field-grid" onSubmit={createPlan}>
                  <div className="field">
                    <label htmlFor="planName">Plan name</label>
                    <input id="planName" className="input" value={planName} onChange={(event) => setPlanName(event.target.value)} placeholder="Pro Community" />
                  </div>
                  <div className="field">
                    <label htmlFor="planPrice">Monthly price</label>
                    <input id="planPrice" className="input" value={planPrice} onChange={(event) => setPlanPrice(event.target.value)} inputMode="decimal" />
                  </div>
                  <div>
                    <button className="btn btn-primary" disabled={savingPlan || !planName.trim()}>
                      {savingPlan ? 'Adding...' : 'Add plan'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="summary-grid" id="growth">
                <div className="panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Referral platform</h2>
                      <p className="panel-subtitle">Clicks, joins, activations, and attributed revenue.</p>
                    </div>
                  </div>
                  <div className="stack">
                    {data.referrals.map((referral) => (
                      <div className="member-card" key={referral.id}>
                        <div className="panel-header" style={{ marginBottom: 4 }}>
                          <strong>@{referral.referrer}</strong>
                          <span className={`status-pill ${referral.status}`}>{referral.status}</span>
                        </div>
                        <div className="summary-note">{referral.referralCode}</div>
                        <div className="summary-note">{referral.clicks} clicks - {money(referral.revenueCents)} revenue</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Rewards engine</h2>
                      <p className="panel-subtitle">XP, levels, badges, unlocks, and sponsor perks.</p>
                    </div>
                  </div>
                  <div className="stack">
                    {data.rewards.map((reward) => (
                      <div className="member-card" key={reward.id}>
                        <div className="panel-header" style={{ marginBottom: 4 }}>
                          <strong>{reward.title}</strong>
                          <span className="metric-pill">{reward.type}</span>
                        </div>
                        <div className="summary-note">{reward.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="summary-grid" id="access">
                <div className="panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Activity timeline</h2>
                      <p className="panel-subtitle">Normalized CRM events for future analytics and AI reports.</p>
                    </div>
                  </div>
                  <div className="stack">
                    {data.activity.map((event) => (
                      <div className="member-card" key={event.id}>
                        <strong>{event.title}</strong>
                        <div className="summary-note">{event.eventType} - {dateShort(event.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ gridColumn: 'span 2' }}>
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Telegram access logs</h2>
                      <p className="panel-subtitle">Audit trail for grants, revokes, invite links, and sync failures.</p>
                    </div>
                  </div>
                  <div className="stack">
                    {data.accessLogs.map((log) => (
                      <div className="member-card" key={log.id}>
                        <div className="panel-header" style={{ marginBottom: 4 }}>
                          <strong>{log.action}</strong>
                          <span className={`status-pill ${log.status}`}>{log.status}</span>
                        </div>
                        <div className="summary-note">{log.message ?? 'No message'} - {dateShort(log.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
