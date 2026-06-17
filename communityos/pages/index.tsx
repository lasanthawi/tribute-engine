import Head from 'next/head'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ActionQueue, SetupStepper } from '@/components/ActionQueue'
import BottomTabs, { BottomTab } from '@/components/BottomTabs'
import CommunityShell from '@/components/CommunityShell'
import {
  AccessQueue,
  MemberRow,
  PlanCard,
  ReferralCampaignCard,
  RewardRuleCard,
  TelegramChatCard,
} from '@/components/CommunityRows'
import { MetricStrip, StarsRevenueCard } from '@/components/MetricStrip'
import {
  DashboardDto,
  EventDto,
  MemberRowDto,
  ProductDto,
  ReferralCampaignDto,
  RewardRuleDto,
  money,
  PlanDto,
  api,
} from '@/lib/api-client'
import { demoDashboard } from '@/lib/demo-data'
import { haptic, initTelegramShell } from '@/lib/telegram-webapp'

type TabKey = 'home' | 'members' | 'access' | 'growth' | 'rewards' | 'more'
type Mode = 'publisher' | 'member'

const tabs: BottomTab<TabKey>[] = [
  { key: 'home', icon: '⌂', label: 'Home' },
  { key: 'members', icon: '◎', label: 'CRM' },
  { key: 'access', icon: '◇', label: 'Access' },
  { key: 'growth', icon: '↗', label: 'Growth' },
  { key: 'rewards', icon: '★', label: 'Rewards' },
  { key: 'more', icon: '⋯', label: 'More' },
]

function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('publisher')
  const [activeTab, setActiveTab] = useState<TabKey>('home')
  const [data, setData] = useState<DashboardDto | null>(null)
  const [preview, setPreview] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState('')
  const [planName, setPlanName] = useState('Premium Circle')
  const [planStars, setPlanStars] = useState('299')
  const [campaignTitle, setCampaignTitle] = useState('Invite 3 serious builders')
  const [rewardTitle, setRewardTitle] = useState('Launch Contributor')

  useEffect(() => {
    initTelegramShell()
    api
      .getDashboard(1)
      .then((dashboard) => {
        setData(mergeDashboard(dashboard))
        setPreview(false)
      })
      .catch(() => {
        setData(demoDashboard)
        setPreview(true)
      })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const member = data?.members[1] ?? data?.members[0]
  const filteredMembers = useMemo(() => {
    if (!data) return []
    const needle = memberFilter.trim().toLowerCase()
    if (!needle) return data.members
    return data.members.filter((row) =>
      [row.username, row.planName, row.accessStatus, row.source].filter(Boolean).join(' ').toLowerCase().includes(needle)
    )
  }, [data, memberFilter])

  function selectTab(tab: TabKey) {
    haptic('light')
    setActiveTab(tab)
  }

  function showToast(message: string) {
    setToast(message)
  }

  function grantAccess(row: MemberRowDto) {
    if (!data) return
    setData({
      ...data,
      metrics: { ...data.metrics, accessIssues: Math.max(0, data.metrics.accessIssues - 1) },
      members: data.members.map((memberRow) =>
        memberRow.id === row.id ? { ...memberRow, accessStatus: 'granted', lastActiveAt: new Date().toISOString() } : memberRow
      ),
      accessLogs: [
        {
          id: Date.now(),
          action: 'grant',
          status: 'success',
          message: `Telegram access granted to @${row.username}`,
          createdAt: new Date().toISOString(),
        },
        ...data.accessLogs,
      ],
    })
    showToast(`Access granted to @${row.username}`)
  }

  function createPlan(event: FormEvent) {
    event.preventDefault()
    if (!data || !planName.trim()) return
    const stars = Math.max(0, Number(planStars || 0))
    const plan: PlanDto = {
      id: Date.now(),
      name: planName.trim(),
      description: 'Telegram Stars membership with automated access control.',
      priceCents: stars * 10,
      stars,
      currency: 'XTR',
      interval: 'month',
      status: 'active',
      subscribers: 0,
    }
    setData({ ...data, plans: [plan, ...data.plans] })
    setPlanName('')
    setPlanStars('299')
    showToast(preview ? 'Preview plan created' : 'Plan created')
  }

  function createCampaign(event: FormEvent) {
    event.preventDefault()
    if (!data || !campaignTitle.trim()) return
    const campaign: ReferralCampaignDto = {
      id: Date.now(),
      title: campaignTitle.trim(),
      reward: 'Unlock bonus content after 3 activated invites',
      status: 'active',
      clicks: 0,
      joins: 0,
      purchases: 0,
      revenueCents: 0,
    }
    setData({ ...data, referralCampaigns: [campaign, ...data.referralCampaigns] })
    setCampaignTitle('')
    showToast('Referral campaign launched')
  }

  function createReward(event: FormEvent) {
    event.preventDefault()
    if (!data || !rewardTitle.trim()) return
    const rule: RewardRuleDto = {
      id: Date.now(),
      title: rewardTitle.trim(),
      trigger: 'Manual or XP-based unlock',
      reward: '+150 XP and badge',
      status: 'active',
    }
    setData({ ...data, rewardRules: [rule, ...data.rewardRules] })
    setRewardTitle('')
    showToast('Reward rule created')
  }

  if (!data) {
    return (
      <>
        <Head>
          <title>CommunityOS</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </Head>
        <main className="co-shell co-loading">
          <span className="co-avatar">CO</span>
          <strong>Loading CommunityOS</strong>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>CommunityOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <CommunityShell
        community={data.community}
        label={preview ? 'Preview workspace' : 'Telegram workspace'}
        right={
          <div className="co-mode-switch" aria-label="View mode">
            <button className={mode === 'publisher' ? 'active' : ''} type="button" onClick={() => setMode('publisher')}>
              Publisher
            </button>
            <button className={mode === 'member' ? 'active' : ''} type="button" onClick={() => setMode('member')}>
              Member
            </button>
          </div>
        }
      >
        {mode === 'publisher' ? (
          <>
            {activeTab === 'home' && (
              <PublisherHome data={data} onOpen={selectTab} />
            )}
            {activeTab === 'members' && (
              <section className="co-stack">
                <div className="co-card">
                  <div className="co-section-head">
                    <div>
                      <span className="co-overline">Community CRM</span>
                      <h2>Members</h2>
                    </div>
                    <span className="co-pill">{filteredMembers.length}</span>
                  </div>
                  <input
                    className="co-search"
                    value={memberFilter}
                    onChange={(event) => setMemberFilter(event.target.value)}
                    placeholder="Search members, plans, status..."
                  />
                  <div className="co-list">
                    {filteredMembers.map((row) => (
                      <MemberRow key={row.id} member={row} onGrant={() => grantAccess(row)} onReward={() => showToast(`Reward queued for @${row.username}`)} />
                    ))}
                  </div>
                </div>
              </section>
            )}
            {activeTab === 'access' && (
              <AccessView data={data} planName={planName} planStars={planStars} onPlanName={setPlanName} onPlanStars={setPlanStars} onCreatePlan={createPlan} onGrant={grantAccess} onToast={showToast} />
            )}
            {activeTab === 'growth' && (
              <GrowthView data={data} campaignTitle={campaignTitle} onCampaignTitle={setCampaignTitle} onCreateCampaign={createCampaign} />
            )}
            {activeTab === 'rewards' && (
              <RewardsView data={data} rewardTitle={rewardTitle} onRewardTitle={setRewardTitle} onCreateReward={createReward} />
            )}
            {activeTab === 'more' && <MoreView data={data} onToast={showToast} />}
            <BottomTabs tabs={tabs} active={activeTab} onChange={selectTab} />
          </>
        ) : (
          <MemberHome data={data} member={member} onToast={showToast} />
        )}
      </CommunityShell>
      {toast && <div className="co-toast">{toast}</div>}
    </>
  )
}

function PublisherHome({ data, onOpen }: { data: DashboardDto; onOpen: (tab: TabKey) => void }) {
  return (
    <section className="co-stack">
      <section className="co-command-card">
        <div>
          <span className="co-overline">Command center</span>
          <h1>Run memberships, access, growth, and rewards from Telegram.</h1>
          <p>{data.metrics.accessIssues} access issues, {data.metrics.pendingRenewals} renewals, and {data.metrics.referralActivations} referral activations need your focus.</p>
        </div>
        <div className="co-health-orb">
          <strong>{data.metrics.healthScore}</strong>
          <span>health</span>
        </div>
      </section>
      <MetricStrip
        items={[
          { label: 'Members', value: String(data.metrics.members), note: `${data.metrics.activeSubscriptions} paid`, tone: 'info' },
          { label: 'Access', value: String(data.metrics.accessIssues), note: 'Need review', tone: data.metrics.accessIssues ? 'warn' : 'ok' },
          { label: 'Products', value: String(data.metrics.productsSold), note: 'Sold this month', tone: 'ok' },
        ]}
      />
      <StarsRevenueCard stars={data.metrics.monthlyStars} revenue={money(data.metrics.monthlyRevenueCents)} />
      <ActionQueue actions={data.nextActions} onOpen={onOpen} />
      <SetupStepper steps={data.setup} />
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Community signals</span>
            <h2>Health feed</h2>
          </div>
        </div>
        <div className="co-signal-list">
          {data.healthSignals.map((signal) => (
            <article className={`co-signal ${signal.tone}`} key={signal.id}>
              <span />
              <div>
                <strong>{signal.title}</strong>
                <p>{signal.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function AccessView({
  data,
  planName,
  planStars,
  onPlanName,
  onPlanStars,
  onCreatePlan,
  onGrant,
  onToast,
}: {
  data: DashboardDto
  planName: string
  planStars: string
  onPlanName: (value: string) => void
  onPlanStars: (value: string) => void
  onCreatePlan: (event: FormEvent) => void
  onGrant: (member: MemberRowDto) => void
  onToast: (message: string) => void
}) {
  return (
    <section className="co-stack">
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Telegram access</span>
            <h2>Groups and channels</h2>
          </div>
          <button className="co-chip-button" type="button" onClick={() => onToast('Access sync queued')}>
            Sync
          </button>
        </div>
        <div className="co-list">
          {data.chats.map((chat) => <TelegramChatCard key={chat.id} chat={chat} />)}
        </div>
      </section>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Stars memberships</span>
            <h2>Plans</h2>
          </div>
        </div>
        <form className="co-inline-form" onSubmit={onCreatePlan}>
          <input value={planName} onChange={(event) => onPlanName(event.target.value)} placeholder="Plan name" />
          <input value={planStars} onChange={(event) => onPlanStars(event.target.value)} inputMode="numeric" placeholder="Stars" />
          <button type="submit">Add</button>
        </form>
        <div className="co-list">
          {data.plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
        </div>
      </section>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Queue</span>
            <h2>Pending access</h2>
          </div>
          <span className="co-pill warn">{data.metrics.accessIssues}</span>
        </div>
        <AccessQueue members={data.members} onGrant={onGrant} />
      </section>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Access ledger</span>
            <h2>Recent syncs</h2>
          </div>
        </div>
        <div className="co-ledger">
          {data.accessLogs.map((log) => (
            <article key={log.id}>
              <span className={`co-state ${log.status === 'success' ? 'granted' : log.status}`}>{log.status}</span>
              <div>
                <strong>{log.action}</strong>
                <p>{log.message}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function GrowthView({
  data,
  campaignTitle,
  onCampaignTitle,
  onCreateCampaign,
}: {
  data: DashboardDto
  campaignTitle: string
  onCampaignTitle: (value: string) => void
  onCreateCampaign: (event: FormEvent) => void
}) {
  return (
    <section className="co-stack">
      <section className="co-card co-accent-card">
        <span className="co-overline">Referral platform</span>
        <h2>Invite loops tied to revenue</h2>
        <p>Track clicks, invites, joins, purchases, and Stars revenue from every member referral.</p>
        <form className="co-inline-form single" onSubmit={onCreateCampaign}>
          <input value={campaignTitle} onChange={(event) => onCampaignTitle(event.target.value)} placeholder="Campaign title" />
          <button type="submit">Launch</button>
        </form>
      </section>
      <div className="co-grid">
        {data.referralCampaigns.map((campaign) => <ReferralCampaignCard key={campaign.id} campaign={campaign} />)}
      </div>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Top referrers</span>
            <h2>Member attribution</h2>
          </div>
        </div>
        <div className="co-ledger">
          {data.referrals.map((referral) => (
            <article key={referral.id}>
              <span className="co-state granted">{referral.status}</span>
              <div>
                <strong>@{referral.referrer}</strong>
                <p>{referral.clicks} clicks · {referral.joins} joins · {referral.purchases} purchases · {money(referral.revenueCents)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function RewardsView({
  data,
  rewardTitle,
  onRewardTitle,
  onCreateReward,
}: {
  data: DashboardDto
  rewardTitle: string
  onRewardTitle: (value: string) => void
  onCreateReward: (event: FormEvent) => void
}) {
  return (
    <section className="co-stack">
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Rewards engine</span>
            <h2>XP, levels, badges</h2>
          </div>
          <span className="co-pill">{data.metrics.xpIssued.toLocaleString()} XP</span>
        </div>
        <form className="co-inline-form single" onSubmit={onCreateReward}>
          <input value={rewardTitle} onChange={(event) => onRewardTitle(event.target.value)} placeholder="Reward rule title" />
          <button type="submit">Create</button>
        </form>
        <div className="co-grid">
          {data.rewardRules.map((rule) => <RewardRuleCard key={rule.id} rule={rule} />)}
        </div>
      </section>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Claimable rewards</span>
            <h2>Member perks</h2>
          </div>
        </div>
        <div className="co-grid">
          {data.rewards.map((reward) => (
            <article className="co-reward-card" key={reward.id}>
              <span className={`co-state ${reward.claimed ? 'granted' : 'pending'}`}>{reward.claimed ? 'claimed' : reward.type}</span>
              <strong>{reward.title}</strong>
              <p>{reward.description}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function MoreView({ data, onToast }: { data: DashboardDto; onToast: (message: string) => void }) {
  return (
    <section className="co-stack">
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">AI community manager</span>
            <h2>Reports and suggestions</h2>
          </div>
          <span className="co-pill ok">{data.ai.weeklyReportStatus}</span>
        </div>
        <div className="co-ai-panel">
          <div>
            <strong>{data.ai.healthScore}</strong>
            <span>health score</span>
          </div>
          <p>{data.ai.faqCount} FAQ answers configured. Weekly report is ready for review.</p>
          <button type="button" onClick={() => onToast('Weekly report opened')}>Open report</button>
        </div>
        <div className="co-signal-list">
          {data.ai.suggestions.map((suggestion) => (
            <article className={`co-signal ${suggestion.tone}`} key={suggestion.id}>
              <span />
              <div>
                <strong>{suggestion.title}</strong>
                <p>{suggestion.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ContentSection title="Events" eyebrow="Webinars, AMAs, meetups" items={data.events} onToast={onToast} />
      <ProductSection products={data.products} onToast={onToast} />
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Settings</span>
            <h2>Community controls</h2>
          </div>
        </div>
        <div className="co-settings-grid">
          {['Bot permissions', 'Stars checkout', 'Access policy', 'Notifications', 'Storage', 'Audit log'].map((item) => (
            <button key={item} type="button" onClick={() => onToast(`${item} opened`)}>
              {item}
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}

function ContentSection({
  title,
  eyebrow,
  items,
  onToast,
}: {
  title: string
  eyebrow: string
  items: EventDto[]
  onToast: (message: string) => void
}) {
  return (
    <section className="co-card">
      <div className="co-section-head">
        <div>
          <span className="co-overline">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button className="co-chip-button" type="button" onClick={() => onToast('Event draft created')}>Create</button>
      </div>
      <div className="co-list">
        {items.map((event) => (
          <article className="co-content-row" key={event.id}>
            <div>
              <strong>{event.title}</strong>
              <p>{event.type} · {dateShort(event.startsAt)} · {event.registrations} registered</p>
            </div>
            <span>{event.priceStars ? `${event.priceStars} XTR` : 'Free'}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductSection({ products, onToast }: { products: ProductDto[]; onToast: (message: string) => void }) {
  return (
    <section className="co-card">
      <div className="co-section-head">
        <div>
          <span className="co-overline">Creator monetization</span>
          <h2>Products and services</h2>
        </div>
        <button className="co-chip-button" type="button" onClick={() => onToast('Product draft created')}>Create</button>
      </div>
      <div className="co-grid">
        {products.map((product) => (
          <article className="co-product-card" key={product.id}>
            <span className={`co-state ${product.status === 'active' ? 'granted' : 'pending'}`}>{product.type.replace('_', ' ')}</span>
            <strong>{product.title}</strong>
            <p>{product.purchases} purchases</p>
            <em>{product.priceStars} XTR</em>
          </article>
        ))}
      </div>
    </section>
  )
}

function MemberHome({ data, member, onToast }: { data: DashboardDto; member: MemberRowDto | undefined; onToast: (message: string) => void }) {
  const progress = member ? Math.min(100, Math.round((member.xp % 1200) / 12)) : 0

  return (
    <section className="co-stack co-member-home">
      <section className="co-command-card">
        <div>
          <span className="co-overline">Member home</span>
          <h1>@{member?.username ?? 'member'}</h1>
          <p>{member?.planName ?? 'Community'} access is {member?.accessStatus ?? 'pending'}. Keep contributing to unlock rewards.</p>
        </div>
        <div className="co-health-orb">
          <strong>L{member?.level ?? 1}</strong>
          <span>{member?.xp ?? 0} XP</span>
        </div>
      </section>
      <section className="co-card">
        <div className="co-section-head">
          <div>
            <span className="co-overline">Progress</span>
            <h2>Next level</h2>
          </div>
          <span className="co-pill">{progress}%</span>
        </div>
        <div className="co-progress"><span style={{ width: `${progress}%` }} /></div>
      </section>
      <section className="co-card co-accent-card">
        <span className="co-overline">Referral loop</span>
        <h2>Invite 3 useful members</h2>
        <p>Unlock bonus sessions once friends join, participate, and activate a plan.</p>
        <button type="button" onClick={() => onToast('Referral link copied')}>Copy referral link</button>
      </section>
      <ProductSection products={data.products} onToast={onToast} />
      <ContentSection title="Upcoming events" eyebrow="Community calendar" items={data.events} onToast={onToast} />
      <RewardsView data={data} rewardTitle="" onRewardTitle={() => undefined} onCreateReward={(event) => event.preventDefault()} />
      <div className="co-member-space" />
    </section>
  )
}

function mergeDashboard(dashboard: DashboardDto): DashboardDto {
  return {
    ...demoDashboard,
    ...dashboard,
    community: dashboard.community ?? demoDashboard.community,
    metrics: { ...demoDashboard.metrics, ...dashboard.metrics },
    members: dashboard.members?.length ? dashboard.members : demoDashboard.members,
    plans: dashboard.plans?.length ? dashboard.plans.map((plan) => ({ ...plan, stars: plan.stars ?? Math.round(plan.priceCents / 10) })) : demoDashboard.plans,
    referrals: dashboard.referrals?.length ? dashboard.referrals.map((referral) => ({ ...referral, invites: referral.invites ?? 0, joins: referral.joins ?? 0, purchases: referral.purchases ?? 0 })) : demoDashboard.referrals,
    rewards: dashboard.rewards?.length ? dashboard.rewards : demoDashboard.rewards,
    activity: dashboard.activity?.length ? dashboard.activity : demoDashboard.activity,
    accessLogs: dashboard.accessLogs?.length ? dashboard.accessLogs : demoDashboard.accessLogs,
  }
}
