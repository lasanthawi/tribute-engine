import Head from 'next/head'
import Link from 'next/link'
import { demoAdminDashboard } from '@/lib/demo-data'
import { money } from '@/lib/api-client'

export default function AdminDashboard() {
  const data = demoAdminDashboard

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

        <section className="co-admin-grid">
          <AdminMetric label="Communities" value={String(data.metrics.communities)} />
          <AdminMetric label="Publishers" value={String(data.metrics.publishers)} />
          <AdminMetric label="Stars" value={`${data.metrics.monthlyStars.toLocaleString()} XTR`} />
          <AdminMetric label="Revenue" value={money(data.metrics.paymentsCents)} />
          <AdminMetric label="Access failures" value={String(data.metrics.accessFailures)} />
          <AdminMetric label="AI requests" value={data.metrics.aiRequests.toLocaleString()} />
        </section>

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>Communities</h2>
            <span className="co-pill">{data.communities.length}</span>
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
              {data.communities.map((community) => (
                <tr key={community.id}>
                  <td>{community.name}</td>
                  <td>{community.owner}</td>
                  <td><span className={`co-state ${community.status === 'active' ? 'granted' : 'pending'}`}>{community.status}</span></td>
                  <td>{community.members}</td>
                  <td>{money(community.revenueCents)}</td>
                  <td>{community.healthScore}</td>
                </tr>
              ))}
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
              {data.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>#{payment.id}</td>
                  <td>{payment.community}</td>
                  <td>{payment.buyer}</td>
                  <td>{payment.stars} XTR</td>
                  <td><span className={`co-state ${payment.status === 'paid' ? 'granted' : 'pending'}`}>{payment.status}</span></td>
                  <td>{formatAdminDate(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>Operational Issues</h2>
            <span className="co-pill warn">{data.issues.length} open</span>
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
              {data.issues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.title}</td>
                  <td>{issue.community}</td>
                  <td><span className={`co-state ${issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'pending' : 'granted'}`}>{issue.severity}</span></td>
                  <td>{issue.status}</td>
                </tr>
              ))}
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
