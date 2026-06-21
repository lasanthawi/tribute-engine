import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AdminCommunityDetailDto,
  AdminDashboardDto,
  AdminPaymentDto,
  AuditEventDto,
  PlatformAdminDto,
  api,
  money,
} from '@/lib/api-client'
import { getInitData, initTelegramShell } from '@/lib/telegram-webapp'

type Tab = 'overview' | 'communities' | 'payments' | 'issues' | 'admins' | 'audit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'communities', label: 'Communities' },
  { id: 'payments', label: 'Payments' },
  { id: 'issues', label: 'Access issues' },
  { id: 'admins', label: 'Admins' },
  { id: 'audit', label: 'Audit log' },
]

export default function AdminDashboard() {
  const [ready, setReady] = useState(false)
  const [hasInitData, setHasInitData] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    initTelegramShell()
    setHasInitData(!!getInitData())
    setReady(true)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      setData(await api.getAdminDashboard())
    } catch (err: any) {
      if (err?.status === 403) setError('Your account is not a platform admin.')
      else if (err?.status === 401) setError('Open this page from inside Telegram to sign in.')
      else setError(err?.message || 'Failed to load admin dashboard')
    }
  }, [])

  useEffect(() => {
    if (ready && hasInitData) load()
  }, [ready, hasInitData, load])

  if (ready && !hasInitData) {
    return (
      <AdminShell>
        <section className="co-admin-notice">
          This dashboard runs inside Telegram. Open it from the bot menu or a CommunityOS deep link so it can sign you in.
        </section>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      {error && (
        <section className="co-admin-notice" style={{ color: 'var(--co-red)' }}>
          {error}
        </section>
      )}

      <nav className="co-admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`co-admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {!data && !error && <section className="co-admin-notice">Loading…</section>}

      {data && tab === 'overview' && <OverviewTab data={data} />}
      {data && tab === 'communities' && <CommunitiesTab data={data} onAction={load} onToast={showToast} />}
      {tab === 'payments' && <PaymentsTab onToast={showToast} />}
      {data && tab === 'issues' && <IssuesTab data={data} onAction={load} onToast={showToast} />}
      {tab === 'admins' && <AdminsTab onToast={showToast} />}
      {tab === 'audit' && <AuditTab onToast={showToast} />}

      {toast && <div className="tg-toast">{toast}</div>}
    </AdminShell>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
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
        {children}
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

function OverviewTab({ data }: { data: AdminDashboardDto }) {
  const o = data.overview
  return (
    <>
      <section className="co-admin-grid">
        <AdminMetric label="Communities" value={`${o.activeCommunities}/${o.communities}`} />
        <AdminMetric label="Publishers" value={String(o.publishers)} />
        <AdminMetric label="New (30d)" value={String(o.newCommunities30d)} />
        <AdminMetric label="Stars (30d)" value={`${o.stars30d.toLocaleString()} XTR`} />
        <AdminMetric label="Revenue (30d)" value={money(o.revenueCents30d)} />
        <AdminMetric label="MRR proxy" value={money(o.mrrCents)} />
        <AdminMetric label="Revenue (all-time)" value={money(o.revenueCentsAllTime)} />
        <AdminMetric label="Expired subs (30d)" value={String(o.expiredSubs30d)} />
        <AdminMetric label="Access success" value={`${o.accessSuccessRate}%`} />
        <AdminMetric label="Pending joins" value={String(o.pendingJoinRequests)} />
        <AdminMetric label="Access failures" value={String(o.accessFailures)} />
      </section>

      <section className="co-admin-panel">
        <div className="co-admin-panel-header">
          <h2>Recent Stars purchases</h2>
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
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td>#{p.id}</td>
                <td>{p.community}</td>
                <td>{p.buyer}</td>
                <td>{p.stars} XTR</td>
                <td><span className={`co-state ${p.status === 'paid' ? 'granted' : 'pending'}`}>{p.status}</span></td>
                <td>{formatAdminDate(p.createdAt)}</td>
              </tr>
            ))}
            {data.payments.length === 0 && (
              <tr><td colSpan={6} style={{ opacity: 0.5, textAlign: 'center' }}>No payments yet</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}

function CommunitiesTab({ data, onAction, onToast }: { data: AdminDashboardDto; onAction: () => void; onToast: (m: string) => void }) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminCommunityDetailDto | null>(null)
  const [busy, setBusy] = useState(false)

  async function openCommunity(id: number) {
    setOpenId(id)
    setDetail(null)
    try {
      setDetail(await api.getAdminCommunity(id))
    } catch (err: any) {
      onToast(err?.message || 'Could not load community')
    }
  }

  async function changeStatus(id: number, status: 'active' | 'paused' | 'archived') {
    setBusy(true)
    try {
      await api.setCommunityStatus(id, status)
      onToast(`Community ${status}`)
      await openCommunity(id)
      onAction()
    } catch (err: any) {
      onToast(err?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.communities.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.owner}</td>
              <td><span className={`co-state ${c.status === 'active' ? 'granted' : 'pending'}`}>{c.status}</span></td>
              <td>{c.members}</td>
              <td>{money(c.revenueCents)}</td>
              <td>{c.healthScore}</td>
              <td><button type="button" className="co-admin-action" onClick={() => openCommunity(c.id)}>Manage</button></td>
            </tr>
          ))}
          {data.communities.length === 0 && (
            <tr><td colSpan={7} style={{ opacity: 0.5, textAlign: 'center' }}>No communities yet</td></tr>
          )}
        </tbody>
      </table>

      {openId !== null && (
        <div style={{ padding: '14px', borderTop: '1px solid rgba(166,185,211,0.16)' }}>
          {!detail && <p style={{ opacity: 0.5 }}>Loading community…</p>}
          {detail && (
            <>
              <h3 style={{ margin: '0 0 4px' }}>{detail.community.name}</h3>
              <p style={{ opacity: 0.6, margin: '0 0 10px', fontSize: 13 }}>
                @{detail.community.owner} · {detail.metrics.members} members · {detail.metrics.activeSubscriptions} active subs · {money(detail.metrics.monthlyRevenueCents)} · {detail.metrics.accessIssues} access issues
              </p>
              <div style={{ marginBottom: 10 }}>
                <button type="button" className="co-admin-action" disabled={busy || detail.community.status === 'active'} onClick={() => changeStatus(detail.community.id, 'active')}>Activate</button>
                <button type="button" className="co-admin-action" disabled={busy || detail.community.status === 'paused'} onClick={() => changeStatus(detail.community.id, 'paused')}>Pause</button>
                <button type="button" className="co-admin-action danger" disabled={busy || detail.community.status === 'archived'} onClick={() => changeStatus(detail.community.id, 'archived')}>Archive</button>
                <button type="button" className="co-admin-action" onClick={() => { setOpenId(null); setDetail(null) }}>Close</button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function PaymentsTab({ onToast }: { onToast: (m: string) => void }) {
  const [payments, setPayments] = useState<AdminPaymentDto[] | null>(null)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.listAdminPayments(status ? { status } : {})
      setPayments(res.payments)
    } catch (err: any) {
      onToast(err?.message || 'Could not load payments')
    }
  }, [status, onToast])

  useEffect(() => { load() }, [load])

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Payments</h2>
        <span className="co-pill">{payments?.length ?? 0}</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {['', 'paid', 'pending', 'failed'].map((s) => (
          <button key={s || 'all'} type="button" className={`co-admin-action ${status === s ? '' : ''}`} style={status === s ? { background: '#2563eb', borderColor: '#2563eb', color: '#fff' } : undefined} onClick={() => setStatus(s)}>
            {s || 'all'}
          </button>
        ))}
      </div>
      <table className="co-admin-table">
        <thead>
          <tr><th>ID</th><th>Community</th><th>Buyer</th><th>Stars</th><th>Amount</th><th>Status</th><th>Created</th></tr>
        </thead>
        <tbody>
          {(payments ?? []).map((p) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.community}</td>
              <td>{p.buyer}</td>
              <td>{p.stars} XTR</td>
              <td>{money(p.amountCents)}</td>
              <td><span className={`co-state ${p.status === 'paid' ? 'granted' : p.status === 'failed' ? 'failed' : 'pending'}`}>{p.status}</span></td>
              <td>{formatAdminDate(p.createdAt)}</td>
            </tr>
          ))}
          {payments && payments.length === 0 && (
            <tr><td colSpan={7} style={{ opacity: 0.5, textAlign: 'center' }}>No payments</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function IssuesTab({ data, onAction, onToast }: { data: AdminDashboardDto; onAction: () => void; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false)

  async function resolve(logId: number) {
    setBusy(true)
    try {
      await api.adminResolveIssue(logId)
      onToast('Issue resolved')
      onAction()
    } catch (err: any) {
      onToast(err?.message || 'Could not resolve')
    } finally {
      setBusy(false)
    }
  }

  async function syncAll() {
    setBusy(true)
    try {
      const res = await api.adminSyncAccess()
      onToast(`Synced ${res.synced}/${res.scanned} pending`)
      onAction()
    } catch (err: any) {
      onToast(err?.message || 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Access issues</h2>
        <button type="button" className="co-admin-action" disabled={busy} onClick={syncAll}>Re-run sync</button>
      </div>
      <table className="co-admin-table">
        <thead>
          <tr><th>Issue</th><th>Community</th><th>Severity</th><th></th></tr>
        </thead>
        <tbody>
          {data.issues.map((issue) => (
            <tr key={issue.id}>
              <td>{issue.title}</td>
              <td>{issue.community}</td>
              <td><span className={`co-state ${issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'pending' : 'granted'}`}>{issue.severity}</span></td>
              <td><button type="button" className="co-admin-action" disabled={busy} onClick={() => resolve(issue.id)}>Resolve</button></td>
            </tr>
          ))}
          {data.issues.length === 0 && (
            <tr><td colSpan={4} style={{ opacity: 0.5, textAlign: 'center' }}>No open issues</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function AdminsTab({ onToast }: { onToast: (m: string) => void }) {
  const [admins, setAdmins] = useState<PlatformAdminDto[] | null>(null)
  const [telegramId, setTelegramId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.listPlatformAdmins()
      setAdmins(res.admins)
    } catch (err: any) {
      onToast(err?.message || 'Could not load admins')
    }
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function add() {
    const id = Number(telegramId.trim())
    if (!Number.isFinite(id) || id <= 0) {
      onToast('Enter a valid Telegram numeric id')
      return
    }
    setBusy(true)
    try {
      const res = await api.addPlatformAdmin({ telegramId: id })
      if (!res.ok) onToast(res.reason || 'Could not add admin')
      else { onToast('Admin added'); setTelegramId(''); await load() }
    } catch (err: any) {
      onToast(err?.message || 'Could not add admin')
    } finally {
      setBusy(false)
    }
  }

  async function remove(userId: number) {
    setBusy(true)
    try {
      const res = await api.removePlatformAdmin(userId)
      if (!res.ok) onToast(res.reason || 'Could not remove admin')
      else { onToast('Admin removed'); await load() }
    } catch (err: any) {
      onToast(err?.message || 'Could not remove admin')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Platform admins</h2>
        <span className="co-pill">{admins?.length ?? 0}</span>
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', gap: 8 }}>
        <input className="co-admin-search" style={{ margin: 0 }} placeholder="Telegram numeric id" value={telegramId} onChange={(e) => setTelegramId(e.target.value)} inputMode="numeric" />
        <button type="button" className="co-admin-action" disabled={busy} onClick={add}>Add</button>
      </div>
      <table className="co-admin-table">
        <thead>
          <tr><th>User</th><th>Telegram ID</th><th>Role</th><th>Added</th><th></th></tr>
        </thead>
        <tbody>
          {(admins ?? []).map((a) => (
            <tr key={a.id}>
              <td>{a.username ? `@${a.username}` : `user_${a.userId}`}</td>
              <td>{a.telegramId ?? '—'}</td>
              <td>{a.role}</td>
              <td>{formatAdminDate(a.createdAt)}</td>
              <td><button type="button" className="co-admin-action danger" disabled={busy} onClick={() => remove(a.userId)}>Remove</button></td>
            </tr>
          ))}
          {admins && admins.length === 0 && (
            <tr><td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>No admins</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function AuditTab({ onToast }: { onToast: (m: string) => void }) {
  const [events, setEvents] = useState<AuditEventDto[] | null>(null)

  useEffect(() => {
    api.listAuditEvents().then((res) => setEvents(res.events)).catch((err) => onToast(err?.message || 'Could not load audit log'))
  }, [onToast])

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Audit log</h2>
        <span className="co-pill">{events?.length ?? 0}</span>
      </div>
      <table className="co-admin-table">
        <thead>
          <tr><th>When</th><th>Actor</th><th>Action</th><th>Community</th><th>Details</th></tr>
        </thead>
        <tbody>
          {(events ?? []).map((e) => (
            <tr key={e.id}>
              <td>{formatAdminDate(e.createdAt)}</td>
              <td>{e.actor}</td>
              <td>{e.eventType}</td>
              <td>{e.community ?? '—'}</td>
              <td style={{ opacity: 0.7, fontSize: 12 }}>{JSON.stringify(e.payload)}</td>
            </tr>
          ))}
          {events && events.length === 0 && (
            <tr><td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>No admin actions recorded yet</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function formatAdminDate(value: string) {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} UTC`
}
