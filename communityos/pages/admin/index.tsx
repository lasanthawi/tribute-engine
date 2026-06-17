import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { money } from '@/lib/api-client'

interface AdminDashboardDto {
  metrics: {
    communities: number
    publishers: number
    monthlyStars: number
    paymentsCents: number
    accessFailures: number
    aiRequests: number
  }
  communities: {
    id: number
    name: string
    owner: string
    status: string
    members: number
    revenueCents: number
    healthScore: number
  }[]
  payments: {
    id: number
    community: string
    buyer: string
    stars: number
    status: string
    createdAt: string
  }[]
  issues: {
    id: number
    title: string
    community: string
    severity: string
    status: string
  }[]
}

const emptyDashboard: AdminDashboardDto = {
  metrics: { communities: 0, publishers: 0, monthlyStars: 0, paymentsCents: 0, accessFailures: 0, aiRequests: 0 },
  communities: [],
  payments: [],
  issues: [],
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message || 'Failed to load admin dashboard'))
  }, [])

  const d = data ?? emptyDashboard

  return (
    <>
      <Head>
        <title>CommunityOS Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="co-admin-shell">
        <header className="co-admin-header">
          <div>
            <span className="co-overline">Platform operations</span>
            <h1>CommunityOS Admin</h1>
          </div>
          <Link className="co-chip-button" href="/">
            Open Mini App
          </Link>
        </header>

        {error && (
          <section className="co-admin-panel">
            <p style={{ color: 'var(--co-red)', padding: '1rem' }}>{error}</p>
          </section>
        )}

        {!data && !error && (
          <section className="co-admin-panel">
            <p style={{ padding: '1rem', opacity: 0.5 }}>Loading…</p>
          </section>
        )}

        <section className="co-admin-grid">
          <AdminMetric label="Communities" value={String(d.metrics.communities)} />
          <AdminMetric label="Publishers" value={String(d.metrics.publishers)} />
          <AdminMetric label="Stars" value={`${d.metrics.monthlyStars.toLocaleString()} XTR`} />
          <AdminMetric label="Revenue" value={money(d.metrics.paymentsCents)} />
          <AdminMetric label="Access failures" value={String(d.metrics.accessFailures)} />
          <AdminMetric label="AI requests" value={d.metrics.aiRequests.toLocaleString()} />
        </section>

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>Communities</h2>
            <span className="co-pill">{d.communities.length}</span>
          </div>
          <table className="co-admin-table">
            <thead>
              <tr>
                <th>Community</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Members</th>
                <th>Revenue</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {d.communities.map((community) => (
                <tr key={community.id}>
                  <td>{community.name}</td>
                  <td>{community.owner}</td>
                  <td><span className={`co-state ${community.status === 'active' ? 'granted' : 'pending'}`}>{community.status}</span></td>
                  <td>{community.members}</td>
                  <td>{money(community.revenueCents)}</td>
                  <td>{community.healthScore}</td>
                </tr>
              ))}
              {d.communities.length === 0 && (
                <tr><td colSpan={6} style={{ opacity: 0.5, textAlign: 'center' }}>No communities yet</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>Stars Purchases</h2>
            <span className="co-pill ok">live</span>
          </div>
          <table className="co-admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Community</th>
                <th>Buyer</th>
                <th>Stars</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {d.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>#{payment.id}</td>
                  <td>{payment.community}</td>
                  <td>{payment.buyer}</td>
                  <td>{payment.stars} XTR</td>
                  <td><span className={`co-state ${payment.status === 'paid' ? 'granted' : 'pending'}`}>{payment.status}</span></td>
                  <td>{formatAdminDate(payment.createdAt)}</td>
                </tr>
              ))}
              {d.payments.length === 0 && (
                <tr><td colSpan={6} style={{ opacity: 0.5, textAlign: 'center' }}>No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>Operational Issues</h2>
            <span className="co-pill warn">{d.issues.length} open</span>
          </div>
          <table className="co-admin-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Community</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.title}</td>
                  <td>{issue.community}</td>
                  <td><span className={`co-state ${issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'pending' : 'granted'}`}>{issue.severity}</span></td>
                  <td>{issue.status}</td>
                </tr>
              ))}
              {d.issues.length === 0 && (
                <tr><td colSpan={4} style={{ opacity: 0.5, textAlign: 'center' }}>No open issues</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </>
  )
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="co-admin-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function formatAdminDate(value: string) {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}
