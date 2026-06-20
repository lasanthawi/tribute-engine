import Head from 'next/head'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { AdminDashboardDto, AiProviderConfigDto, api, money } from '@/lib/api-client'
import { initTelegramShell } from '@/lib/telegram-webapp'

const emptyDashboard: AdminDashboardDto = {
  metrics: { communities: 0, publishers: 0, monthlyStars: 0, paymentsCents: 0, accessFailures: 0, aiRequests: 0 },
  communities: [],
  payments: [],
  issues: [],
}

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

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [providers, setProviders] = useState<AiProviderConfigDto[]>([])
  const [providersError, setProvidersError] = useState<string | null>(null)
  const [newProvider, setNewProvider] = useState<AiProviderConfigDto['provider']>('anthropic')
  const [newLabel, setNewLabel] = useState('Anthropic')
  const [newModel, setNewModel] = useState(DEFAULT_MODEL.anthropic)
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const [newEnvVar, setNewEnvVar] = useState(DEFAULT_ENV_VAR.anthropic)

  function reloadProviders() {
    api.admin
      .listAiProviders()
      .then((rows) => setProviders(rows))
      .catch((err) => setProvidersError(err.message || 'Failed to load AI providers'))
  }

  useEffect(() => {
    initTelegramShell()
    api.admin
      .getDashboard()
      .then((dashboard) => setData(dashboard))
      .catch((err) => setError(err.message || 'Failed to load admin dashboard'))
    reloadProviders()
  }, [])

  function handleProviderTypeChange(provider: AiProviderConfigDto['provider']) {
    setNewProvider(provider)
    setNewLabel(provider === 'custom' ? 'Custom Provider' : provider[0].toUpperCase() + provider.slice(1))
    setNewModel(DEFAULT_MODEL[provider])
    setNewEnvVar(DEFAULT_ENV_VAR[provider])
  }

  function handleAddProvider(event: FormEvent) {
    event.preventDefault()
    if (!newLabel.trim() || !newModel.trim() || !newEnvVar.trim()) return
    api.admin
      .createAiProvider({
        provider: newProvider,
        label: newLabel.trim(),
        model: newModel.trim(),
        baseUrl: newBaseUrl.trim() || null,
        apiKeyEnvVar: newEnvVar.trim(),
        priority: providers.length,
      })
      .then(() => {
        setNewBaseUrl('')
        reloadProviders()
      })
      .catch((err) => setProvidersError(err.message || 'Failed to add AI provider'))
  }

  function handleToggleEnabled(provider: AiProviderConfigDto) {
    api.admin
      .updateAiProvider(provider.id, { enabled: !provider.enabled })
      .then(reloadProviders)
      .catch((err) => setProvidersError(err.message || 'Failed to update AI provider'))
  }

  function handlePriorityChange(provider: AiProviderConfigDto, priority: number) {
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

        <section className="co-admin-panel">
          <div className="co-admin-panel-header">
            <h2>AI Provider Gateway</h2>
            <span className="co-pill">{providers.filter((p) => p.enabled).length} enabled</span>
          </div>

          {providersError && <p style={{ color: 'var(--co-red)', padding: '1rem' }}>{providersError}</p>}

          <form className="co-admin-form" onSubmit={handleAddProvider}>
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
              <button type="submit" className="co-chip-button">Add provider</button>
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
                      onBlur={(event) => handlePriorityChange(provider, Number(event.target.value))}
                    />
                  </td>
                  <td><span className={`co-state ${provider.enabled ? 'granted' : 'pending'}`}>{provider.enabled ? 'enabled' : 'disabled'}</span></td>
                  <td className="co-admin-row-actions">
                    <button type="button" className="co-admin-toggle" onClick={() => handleToggleEnabled(provider)}>
                      {provider.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button type="button" className="co-admin-toggle" onClick={() => handleDeleteProvider(provider)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr><td colSpan={7} style={{ opacity: 0.5, textAlign: 'center' }}>No AI providers configured</td></tr>
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
