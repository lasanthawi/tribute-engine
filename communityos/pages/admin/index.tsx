import Head from 'next/head'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import {
  AdminDashboardDto,
  AdminPaymentDto,
  AiProviderConfigDto,
  AuditEventDto,
  PlatformAdminDto,
  api,
  money,
} from '@/lib/api-client'
import { initTelegramShell } from '@/lib/telegram-webapp'

const DEFAULT_ENV_VAR: Record<AiProviderConfigDto['provider'], string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  custom: 'CUSTOM_AI_API_KEY',
}

const DEFAULT_MODEL: Record<AiProviderConfigDto['provider'], string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  custom: '',
}

type TabKey = 'overview' | 'communities' | 'payments' | 'issues' | 'admins' | 'audit' | 'ai'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'communities', label: 'Communities' },
  { key: 'payments', label: 'Payments' },
  { key: 'issues', label: 'Issues' },
  { key: 'admins', label: 'Admins' },
  { key: 'audit', label: 'Audit log' },
  { key: 'ai', label: 'AI gateway' },
]

type LoadState = 'loading' | 'ready' | 'error' | 'denied'

export default function AdminDashboard() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const [providers, setProviders] = useState<AiProviderConfigDto[]>([])
  const [providersError, setProvidersError] = useState<string | null>(null)

  const [admins, setAdmins] = useState<PlatformAdminDto[]>([])
  const [adminsError, setAdminsError] = useState<string | null>(null)

  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([])
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditType, setAuditType] = useState('')

  const [payments, setPayments] = useState<AdminPaymentDto[]>([])
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [paymentsStatus, setPaymentsStatus] = useState('')
  const [paymentsDays, setPaymentsDays] = useState('')

  const [communitySearch, setCommunitySearch] = useState('')
  const [communityBusyId, setCommunityBusyId] = useState<number | null>(null)
  const [issueBusyId, setIssueBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function loadDashboard() {
    setLoadState('loading')
    setLoadErrorMessage(null)
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(Object.assign(new Error('Request timed out. Check your connection and try again.'), { status: 0 }))
      }, 20000)
    })
    Promise.race([api.admin.getDashboard(), timeout])
      .then((dashboard) => {
        setData(dashboard)
        setLoadState('ready')
        reloadProviders()
        reloadAdmins()
        reloadAudit('')
        reloadPayments('', '')
      })
      .catch((err) => {
        if (err?.status === 401 || err?.status === 403) {
          setLoadState('denied')
        } else {
          setLoadErrorMessage(err?.message || 'Failed to load admin dashboard')
          setLoadState('error')
        }
      })
  }

  useEffect(() => {
    initTelegramShell()
    loadDashboard()
  }, [])

  function reloadProviders() {
    api.admin
      .listAiProviders()
      .then((rows) => setProviders(rows))
      .catch((err) => setProvidersError(err.message || 'Failed to load AI providers'))
  }

  function reloadAdmins() {
    api.admin
      .listAdmins()
      .then((rows) => setAdmins(rows))
      .catch((err) => setAdminsError(err.message || 'Failed to load admins'))
  }

  function reloadAudit(type: string) {
    api.admin
      .listAudit({ type: type || undefined })
      .then((rows) => setAuditEvents(rows))
      .catch((err) => setAuditError(err.message || 'Failed to load audit log'))
  }

  function reloadPayments(status: string, days: string) {
    api.admin
      .listPayments({ status: status || undefined, days: days ? Number(days) : undefined })
      .then((rows) => setPayments(rows))
      .catch((err) => setPaymentsError(err.message || 'Failed to load payments'))
  }

  function handleResolveIssue(issueId: number) {
    setIssueBusyId(issueId)
    setActionError(null)
    api.admin
      .resolveIssue(issueId)
      .then(() => loadDashboard())
      .catch((err) => setActionError(err.message || 'Failed to resolve issue'))
      .finally(() => setIssueBusyId(null))
  }

  function handleCommunityAction(communityId: number, action: 'activate' | 'pause' | 'archive') {
    setCommunityBusyId(communityId)
    setActionError(null)
    api.admin
      .setCommunityStatus(communityId, action)
      .then(() => loadDashboard())
      .catch((err) => setActionError(err.message || 'Failed to update community'))
      .finally(() => setCommunityBusyId(null))
  }

  function handleAddAdmin(telegramId: number, role: string) {
    api.admin
      .addAdmin({ telegramId, role })
      .then((result) => {
        if (result.ok) reloadAdmins()
        else setAdminsError(result.error || 'Failed to add admin')
      })
      .catch((err) => setAdminsError(err.message || 'Failed to add admin'))
  }

  function handleRemoveAdmin(userId: number) {
    api.admin
      .removeAdmin(userId)
      .then((result) => {
        if (result.ok) reloadAdmins()
        else setAdminsError(result.error || 'Failed to remove admin')
      })
      .catch((err) => setAdminsError(err.message || 'Failed to remove admin'))
  }

  function handleAddProvider(input: {
    provider: AiProviderConfigDto['provider']
    label: string
    model: string
    baseUrl: string
    envVar: string
  }) {
    api.admin
      .createAiProvider({
        provider: input.provider,
        label: input.label,
        model: input.model,
        baseUrl: input.baseUrl || null,
        apiKeyEnvVar: input.envVar,
        priority: providers.length,
      })
      .then(reloadProviders)
      .catch((err) => setProvidersError(err.message || 'Failed to add AI provider'))
  }

  function handleToggleProviderEnabled(provider: AiProviderConfigDto) {
    api.admin
      .updateAiProvider(provider.id, { enabled: !provider.enabled })
      .then(reloadProviders)
      .catch((err) => setProvidersError(err.message || 'Failed to update AI provider'))
  }

  function handleProviderPriorityChange(provider: AiProviderConfigDto, priority: number) {
    if (Number.isNaN(priority)) return
    api.admin
      .updateAiProvider(provider.id, { priority })
      .then(reloadProviders)
      .catch((err) => setProvidersError(err.message || 'Failed to update AI provider'))
  }

  function handleDeleteProvider(provider: AiProviderConfigDto) {
    api.admin
      .deleteAiProvider(provider.id)
      .then(reloadProviders)
      .catch((err) => setProvidersError(err.message || 'Failed to delete AI provider'))
  }

  if (loadState === 'loading') {
    return (
      <AdminShell>
        <main className="co-admin-shell co-admin-center">
          <div className="co-admin-spinner" />
          <p style={{ opacity: 0.6, marginTop: 14 }}>Loading admin dashboard…</p>
        </main>
      </AdminShell>
    )
  }

  if (loadState === 'denied') {
    return (
      <AdminShell>
        <main className="co-admin-shell co-admin-center">
          <span className="co-overline">Platform operations</span>
          <h1 style={{ margin: '8px 0' }}>Access denied</h1>
          <p style={{ opacity: 0.7, maxWidth: 320 }}>
            You don&apos;t have platform admin access. Ask an existing admin to add your Telegram account, then try again.
          </p>
          <Link className="co-chip-button" href="/" style={{ marginTop: 18 }}>
            Go back
          </Link>
        </main>
      </AdminShell>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <AdminShell>
        <main className="co-admin-shell co-admin-center">
          <h1 style={{ margin: '8px 0' }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, maxWidth: 320 }}>{loadErrorMessage}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="button" className="co-chip-button" onClick={loadDashboard}>
              Retry
            </button>
            <Link className="co-chip-button" href="/">
              Go back
            </Link>
          </div>
        </main>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
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

        <nav className="co-admin-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`co-admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {actionError && (
          <section className="co-admin-notice" style={{ marginBottom: 14, color: 'var(--tg-red)' }}>
            {actionError}
          </section>
        )}

        {tab === 'overview' && (
          <OverviewTab data={data} onResolveIssue={handleResolveIssue} issueBusyId={issueBusyId} onGoToTab={setTab} />
        )}

        {tab === 'communities' && (
          <CommunitiesTab
            communities={data.communities}
            search={communitySearch}
            onSearchChange={setCommunitySearch}
            onAction={handleCommunityAction}
            busyId={communityBusyId}
          />
        )}

        {tab === 'payments' && (
          <PaymentsTab
            payments={payments}
            error={paymentsError}
            status={paymentsStatus}
            days={paymentsDays}
            onStatusChange={(value) => {
              setPaymentsStatus(value)
              reloadPayments(value, paymentsDays)
            }}
            onDaysChange={(value) => {
              setPaymentsDays(value)
              reloadPayments(paymentsStatus, value)
            }}
          />
        )}

        {tab === 'issues' && <IssuesTab issues={data.issues} onResolve={handleResolveIssue} busyId={issueBusyId} />}

        {tab === 'admins' && (
          <AdminsTab admins={admins} error={adminsError} onAdd={handleAddAdmin} onRemove={handleRemoveAdmin} />
        )}

        {tab === 'audit' && (
          <AuditTab
            events={auditEvents}
            error={auditError}
            type={auditType}
            onTypeChange={(value) => {
              setAuditType(value)
              reloadAudit(value)
            }}
          />
        )}

        {tab === 'ai' && (
          <AiGatewayTab
            providers={providers}
            error={providersError}
            onAdd={handleAddProvider}
            onToggleEnabled={handleToggleProviderEnabled}
            onPriorityChange={handleProviderPriorityChange}
            onDelete={handleDeleteProvider}
          />
        )}
      </main>
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
      {children}
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

function OverviewTab({
  data,
  onResolveIssue,
  issueBusyId,
  onGoToTab,
}: {
  data: AdminDashboardDto
  onResolveIssue: (id: number) => void
  issueBusyId: number | null
  onGoToTab: (tab: TabKey) => void
}) {
  return (
    <>
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
          <button type="button" className="co-admin-toggle" onClick={() => onGoToTab('communities')}>
            View all
          </button>
        </div>
        <table className="co-admin-table">
          <thead>
            <tr>
              <th>Community</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Members</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.communities.slice(0, 5).map((community) => (
              <tr key={community.id}>
                <td>{community.name}</td>
                <td>{community.owner}</td>
                <td>
                  <span className={`co-state ${community.status === 'active' ? 'granted' : 'pending'}`}>{community.status}</span>
                </td>
                <td>{community.members}</td>
                <td>{money(community.revenueCents)}</td>
              </tr>
            ))}
            {data.communities.length === 0 && (
              <tr>
                <td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>
                  No communities yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="co-admin-panel">
        <div className="co-admin-panel-header">
          <h2>Recent payments</h2>
          <button type="button" className="co-admin-toggle" onClick={() => onGoToTab('payments')}>
            View all
          </button>
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
            {data.payments.slice(0, 5).map((payment) => (
              <tr key={payment.id}>
                <td>#{payment.id}</td>
                <td>{payment.community}</td>
                <td>{payment.buyer}</td>
                <td>{payment.stars} XTR</td>
                <td>
                  <span className={`co-state ${payment.status === 'paid' ? 'granted' : 'pending'}`}>{payment.status}</span>
                </td>
                <td>{formatAdminDate(payment.createdAt)}</td>
              </tr>
            ))}
            {data.payments.length === 0 && (
              <tr>
                <td colSpan={6} style={{ opacity: 0.5, textAlign: 'center' }}>
                  No payments yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="co-admin-panel">
        <div className="co-admin-panel-header">
          <h2>Open issues</h2>
          <span className="co-pill warn">{data.issues.length} open</span>
        </div>
        <table className="co-admin-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Community</th>
              <th>Severity</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.issues.slice(0, 5).map((issue) => (
              <tr key={issue.id}>
                <td>{issue.title}</td>
                <td>{issue.community}</td>
                <td>
                  <span className={`co-state ${issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'pending' : 'granted'}`}>
                    {issue.severity}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="co-admin-toggle"
                    disabled={issueBusyId === issue.id}
                    onClick={() => onResolveIssue(issue.id)}
                  >
                    {issueBusyId === issue.id ? 'Resolving…' : 'Resolve'}
                  </button>
                </td>
              </tr>
            ))}
            {data.issues.length === 0 && (
              <tr>
                <td colSpan={4} style={{ opacity: 0.5, textAlign: 'center' }}>
                  No open issues
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}

function CommunitiesTab({
  communities,
  search,
  onSearchChange,
  onAction,
  busyId,
}: {
  communities: AdminDashboardDto['communities']
  search: string
  onSearchChange: (value: string) => void
  onAction: (id: number, action: 'activate' | 'pause' | 'archive') => void
  busyId: number | null
}) {
  const term = search.trim().toLowerCase()
  const filtered = term
    ? communities.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.handle ?? '').toLowerCase().includes(term) ||
          c.owner.toLowerCase().includes(term)
      )
    : communities

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Communities</h2>
        <span className="co-pill">{filtered.length}</span>
      </div>
      <div style={{ padding: '14px 14px 0' }}>
        <input
          className="co-admin-search"
          placeholder="Search by name, handle, or owner…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
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
          {filtered.map((community) => (
            <tr key={community.id}>
              <td>{community.name}</td>
              <td>{community.owner}</td>
              <td>
                <span className={`co-state ${community.status === 'active' ? 'granted' : 'pending'}`}>{community.status}</span>
              </td>
              <td>{community.members}</td>
              <td>{money(community.revenueCents)}</td>
              <td>{community.healthScore}</td>
              <td className="co-admin-row-actions">
                {community.status !== 'active' && (
                  <button
                    type="button"
                    className="co-admin-toggle"
                    disabled={busyId === community.id}
                    onClick={() => onAction(community.id, 'activate')}
                  >
                    Activate
                  </button>
                )}
                {community.status === 'active' && (
                  <button
                    type="button"
                    className="co-admin-toggle"
                    disabled={busyId === community.id}
                    onClick={() => onAction(community.id, 'pause')}
                  >
                    Pause
                  </button>
                )}
                {community.status !== 'archived' && (
                  <button
                    type="button"
                    className="co-admin-toggle"
                    disabled={busyId === community.id}
                    onClick={() => onAction(community.id, 'archive')}
                  >
                    Archive
                  </button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} style={{ opacity: 0.5, textAlign: 'center' }}>
                No communities found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function PaymentsTab({
  payments,
  error,
  status,
  days,
  onStatusChange,
  onDaysChange,
}: {
  payments: AdminPaymentDto[]
  error: string | null
  status: string
  days: string
  onStatusChange: (value: string) => void
  onDaysChange: (value: string) => void
}) {
  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Stars purchases</h2>
        <span className="co-pill ok">live</span>
      </div>

      {error && <p style={{ color: 'var(--tg-red)', padding: '1rem' }}>{error}</p>}

      <div className="co-admin-filterbar">
        <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={days} onChange={(event) => onDaysChange(event.target.value)}>
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <table className="co-admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Community</th>
            <th>Buyer</th>
            <th>Stars</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Source</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>#{payment.id}</td>
              <td>{payment.community}</td>
              <td>{payment.buyer ?? '—'}</td>
              <td>{payment.stars} XTR</td>
              <td>{money(payment.amountCents)}</td>
              <td>
                <span className={`co-state ${payment.status === 'paid' ? 'granted' : payment.status === 'failed' ? 'failed' : 'pending'}`}>
                  {payment.status}
                </span>
              </td>
              <td>{payment.source}</td>
              <td>{formatAdminDate(payment.createdAt)}</td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={8} style={{ opacity: 0.5, textAlign: 'center' }}>
                No payments match these filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function IssuesTab({
  issues,
  onResolve,
  busyId,
}: {
  issues: AdminDashboardDto['issues']
  onResolve: (id: number) => void
  busyId: number | null
}) {
  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Operational issues</h2>
        <span className="co-pill warn">{issues.length} open</span>
      </div>
      <table className="co-admin-table">
        <thead>
          <tr>
            <th>Issue</th>
            <th>Community</th>
            <th>Severity</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>{issue.title}</td>
              <td>{issue.community}</td>
              <td>
                <span className={`co-state ${issue.severity === 'high' ? 'failed' : issue.severity === 'medium' ? 'pending' : 'granted'}`}>
                  {issue.severity}
                </span>
              </td>
              <td>{issue.status}</td>
              <td>
                <button type="button" className="co-admin-toggle" disabled={busyId === issue.id} onClick={() => onResolve(issue.id)}>
                  {busyId === issue.id ? 'Resolving…' : 'Resolve'}
                </button>
              </td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr>
              <td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>
                No open issues
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function AdminsTab({
  admins,
  error,
  onAdd,
  onRemove,
}: {
  admins: PlatformAdminDto[]
  error: string | null
  onAdd: (telegramId: number, role: string) => void
  onRemove: (userId: number) => void
}) {
  const [telegramId, setTelegramId] = useState('')
  const [role, setRole] = useState('operator')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = Number(telegramId.trim())
    if (!Number.isFinite(id) || id <= 0) return
    onAdd(id, role)
    setTelegramId('')
  }

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Platform admins</h2>
        <span className="co-pill">{admins.length}</span>
      </div>

      {error && <p style={{ color: 'var(--tg-red)', padding: '1rem' }}>{error}</p>}

      <form className="co-admin-form" onSubmit={handleSubmit}>
        <label>
          Telegram ID
          <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="123456789" />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="operator">Operator</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <div className="co-admin-form-actions">
          <button type="submit" className="co-chip-button">
            Add admin
          </button>
        </div>
      </form>

      <table className="co-admin-table">
        <thead>
          <tr>
            <th>Telegram ID</th>
            <th>Username</th>
            <th>Role</th>
            <th>Added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => (
            <tr key={admin.id}>
              <td>{admin.telegramId ?? '—'}</td>
              <td>{admin.username ? `@${admin.username}` : '—'}</td>
              <td>{admin.role}</td>
              <td>{formatAdminDate(admin.createdAt)}</td>
              <td>
                <button type="button" className="co-admin-toggle" onClick={() => onRemove(admin.userId)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {admins.length === 0 && (
            <tr>
              <td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>
                No platform admins yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function AuditTab({
  events,
  error,
  type,
  onTypeChange,
}: {
  events: AuditEventDto[]
  error: string | null
  type: string
  onTypeChange: (value: string) => void
}) {
  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>Audit log</h2>
        <span className="co-pill">{events.length}</span>
      </div>

      {error && <p style={{ color: 'var(--tg-red)', padding: '1rem' }}>{error}</p>}

      <div className="co-admin-filterbar">
        <input
          placeholder="Filter by event type…"
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
        />
      </div>

      <table className="co-admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Actor</th>
            <th>Community</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{formatAdminDate(event.createdAt)}</td>
              <td>{event.eventType}</td>
              <td>{event.actorUserId ?? '—'}</td>
              <td>{event.communityId ?? '—'}</td>
              <td style={{ maxWidth: 320, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {Object.keys(event.payload ?? {}).length ? JSON.stringify(event.payload) : '—'}
              </td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={5} style={{ opacity: 0.5, textAlign: 'center' }}>
                No audit events yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function AiGatewayTab({
  providers,
  error,
  onAdd,
  onToggleEnabled,
  onPriorityChange,
  onDelete,
}: {
  providers: AiProviderConfigDto[]
  error: string | null
  onAdd: (input: { provider: AiProviderConfigDto['provider']; label: string; model: string; baseUrl: string; envVar: string }) => void
  onToggleEnabled: (provider: AiProviderConfigDto) => void
  onPriorityChange: (provider: AiProviderConfigDto, priority: number) => void
  onDelete: (provider: AiProviderConfigDto) => void
}) {
  const [newProvider, setNewProvider] = useState<AiProviderConfigDto['provider']>('anthropic')
  const [newLabel, setNewLabel] = useState('Anthropic')
  const [newModel, setNewModel] = useState(DEFAULT_MODEL.anthropic)
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const [newEnvVar, setNewEnvVar] = useState(DEFAULT_ENV_VAR.anthropic)

  function handleProviderTypeChange(provider: AiProviderConfigDto['provider']) {
    setNewProvider(provider)
    setNewLabel(provider === 'custom' ? 'Custom Provider' : provider[0].toUpperCase() + provider.slice(1))
    setNewModel(DEFAULT_MODEL[provider])
    setNewEnvVar(DEFAULT_ENV_VAR[provider])
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!newLabel.trim() || !newModel.trim() || !newEnvVar.trim()) return
    onAdd({ provider: newProvider, label: newLabel.trim(), model: newModel.trim(), baseUrl: newBaseUrl.trim(), envVar: newEnvVar.trim() })
    setNewBaseUrl('')
  }

  return (
    <section className="co-admin-panel">
      <div className="co-admin-panel-header">
        <h2>AI provider gateway</h2>
        <span className="co-pill">{providers.filter((p) => p.enabled).length} enabled</span>
      </div>

      {error && <p style={{ color: 'var(--tg-red)', padding: '1rem' }}>{error}</p>}

      <form className="co-admin-form" onSubmit={handleSubmit}>
        <label>
          Provider
          <select value={newProvider} onChange={(event) => handleProviderTypeChange(event.target.value as AiProviderConfigDto['provider'])}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          Label
          <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
        </label>
        <label>
          Model
          <input value={newModel} onChange={(event) => setNewModel(event.target.value)} placeholder="model id" />
        </label>
        <label>
          Base URL {newProvider !== 'custom' && '(optional override)'}
          <input
            value={newBaseUrl}
            onChange={(event) => setNewBaseUrl(event.target.value)}
            placeholder={newProvider === 'custom' ? 'https://your-gateway.example.com' : 'leave blank for default'}
          />
        </label>
        <label>
          API key env var
          <input value={newEnvVar} onChange={(event) => setNewEnvVar(event.target.value)} />
        </label>
        <div className="co-admin-form-actions">
          <button type="submit" className="co-chip-button">
            Add provider
          </button>
        </div>
      </form>
      <p style={{ padding: '0 14px 14px', color: '#8f9db1', fontSize: 12 }}>
        Set the named env var in your deployment — keys are never stored in the database, only the variable name is.
      </p>

      <table className="co-admin-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Provider</th>
            <th>Model</th>
            <th>Env var</th>
            <th>Priority</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => (
            <tr key={provider.id}>
              <td>{provider.label}</td>
              <td>{provider.provider}</td>
              <td>{provider.model}</td>
              <td>{provider.apiKeyEnvVar}</td>
              <td>
                <input
                  type="number"
                  defaultValue={provider.priority}
                  style={{ width: 56 }}
                  onBlur={(event) => onPriorityChange(provider, Number(event.target.value))}
                />
              </td>
              <td>
                <span className={`co-state ${provider.enabled ? 'granted' : 'pending'}`}>{provider.enabled ? 'enabled' : 'disabled'}</span>
              </td>
              <td className="co-admin-row-actions">
                <button type="button" className="co-admin-toggle" onClick={() => onToggleEnabled(provider)}>
                  {provider.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" className="co-admin-toggle" onClick={() => onDelete(provider)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {providers.length === 0 && (
            <tr>
              <td colSpan={7} style={{ opacity: 0.5, textAlign: 'center' }}>
                No AI providers configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
