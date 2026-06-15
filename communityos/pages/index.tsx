import Head from 'next/head'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { api, CommunitySummaryDto, MeDto } from '@/lib/api-client'
import { initTelegramShell } from '@/lib/telegram-webapp'

export default function Home() {
  const [me, setMe] = useState<MeDto | null>(null)
  const [communities, setCommunities] = useState<CommunitySummaryDto[] | null>(null)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    api
      .getMe()
      .then((data) => {
        setMe(data)
        setCommunities(data.communities)
      })
      .catch(() => {
        setMe(null)
        setCommunities([])
      })
  }

  useEffect(() => {
    initTelegramShell()
    refresh()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const created = await api.createCommunity({ name: name.trim(), handle: handle.trim(), description: description.trim() })
      setName('')
      setHandle('')
      setDescription('')
      setCommunities((current) => [created.community, ...(current ?? [])])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create community')
    } finally {
      setSaving(false)
    }
  }

  const firstCommunity = communities?.[0]

  return (
    <>
      <Head>
        <title>CommunityOS</title>
      </Head>
      <main className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">CO</span>
            <div>
              <p className="eyebrow">Telegram community infrastructure</p>
              <h1 className="title">CommunityOS</h1>
            </div>
          </div>
          {firstCommunity && (
            <Link className="btn btn-primary" href={`/community/${firstCommunity.id}`}>
              Open dashboard
            </Link>
          )}
        </header>

        <section className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Operating model</div>
            <div className="summary-value">SaaS</div>
            <div className="summary-note">Owner-first, not participant-first.</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Core loop</div>
            <div className="summary-value">CRM</div>
            <div className="summary-note">Members, access, referrals, rewards.</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Growth layer</div>
            <div className="summary-value">Referrals</div>
            <div className="summary-note">Community-scoped attribution.</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Shared engine</div>
            <div className="summary-value">XP</div>
            <div className="summary-note">Append-only rewards ledger.</div>
          </div>
        </section>

        <div className="layout-grid">
          <aside className="sidebar">
            <a className="nav-link active" href="#communities">
              Communities <span>{communities?.length ?? '-'}</span>
            </a>
            <a className="nav-link" href="#create">
              New community <span>+</span>
            </a>
            <a className="nav-link" href="#modules">
              Modules <span>7</span>
            </a>
            <a className="nav-link" href="#beta">
              Beta scope <span>Core</span>
            </a>
          </aside>

          <div className="stack">
            <section className="panel" id="communities">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Owned communities</h2>
                  <p className="panel-subtitle">{me?.username ? `Signed in as @${me.username}` : 'Demo mode loads without Telegram credentials.'}</p>
                </div>
              </div>

              {communities === null && <div className="empty">Loading communities...</div>}
              {communities !== null && communities.length === 0 && <div className="empty">No communities yet. Create one below.</div>}
              {communities && communities.length > 0 && (
                <div className="table-panel">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '34%' }}>Community</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th style={{ width: 132 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communities.map((community) => (
                        <tr key={community.id}>
                          <td>
                            <div className="truncate">{community.name}</div>
                            <div className="summary-note">{community.handle ?? 'No handle'}</div>
                          </td>
                          <td>
                            <span className={`status-pill ${community.status}`}>{community.status}</span>
                          </td>
                          <td className="truncate">{community.description ?? 'No description'}</td>
                          <td>
                            <Link className="btn" href={`/community/${community.id}`}>
                              Manage
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel" id="create">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Create community</h2>
                  <p className="panel-subtitle">This creates the owner record, default AI settings, and first XP event.</p>
                </div>
              </div>
              <form className="stack" onSubmit={submit}>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input id="name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Builder Circle" />
                  </div>
                  <div className="field">
                    <label htmlFor="handle">Telegram handle</label>
                    <input id="handle" className="input" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@buildercircle" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    className="textarea"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Paid Telegram community for builders shipping every week."
                  />
                </div>
                {error && <span className="status-pill failed">{error}</span>}
                <div>
                  <button className="btn btn-primary" disabled={saving || !name.trim()}>
                    {saving ? 'Creating...' : 'Create community'}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel" id="modules">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Beta modules</h2>
                  <p className="panel-subtitle">Functional core now, clean extension points for the full platform.</p>
                </div>
              </div>
              <div className="summary-grid">
                {['Memberships', 'Community CRM', 'Referrals', 'Rewards', 'Access Control', 'Analytics', 'AI Manager'].map((module) => (
                  <div className="summary-card" key={module}>
                    <div className="summary-label">Module</div>
                    <div className="summary-value" style={{ fontSize: 17 }}>
                      {module}
                    </div>
                    <div className="summary-note">{module === 'AI Manager' ? 'Settings/stubs in beta' : 'Operational in beta'}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
