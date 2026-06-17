import { MemberRowDto, PlanDto, ReferralCampaignDto, RewardRuleDto, TelegramChatDto, money } from '@/lib/api-client'

function dateShort(iso: string | null) {
  if (!iso) return 'No activity'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

export function MemberRow({ member, onGrant, onReward }: { member: MemberRowDto; onGrant: () => void; onReward: () => void }) {
  const needsAccess = member.accessStatus === 'pending' || member.accessStatus === 'failed'

  return (
    <article className="co-member-row">
      <span className="co-member-avatar">{initials(member.username)}</span>
      <div className="co-member-main">
        <div>
          <strong>@{member.username}</strong>
          <span className={`co-state ${member.accessStatus}`}>{member.accessStatus}</span>
        </div>
        <p>
          {member.planName ?? 'No plan'} · {member.subscriptionStatus} · L{member.level} · {dateShort(member.lastActiveAt)}
        </p>
      </div>
      <button type="button" onClick={needsAccess ? onGrant : onReward}>
        {needsAccess ? 'Grant' : 'Reward'}
      </button>
    </article>
  )
}

export function AccessQueue({ members, onGrant }: { members: MemberRowDto[]; onGrant: (member: MemberRowDto) => void }) {
  const queued = members.filter((member) => member.accessStatus === 'pending' || member.accessStatus === 'failed')

  if (queued.length === 0) {
    return (
      <div className="co-empty">
        <strong>Access queue is clear</strong>
        <p>New purchases, trials, and join requests will appear here before Telegram access is granted.</p>
      </div>
    )
  }

  return (
    <div className="co-list">
      {queued.map((member) => (
        <MemberRow key={member.id} member={member} onGrant={() => onGrant(member)} onReward={() => undefined} />
      ))}
    </div>
  )
}

export function TelegramChatCard({ chat }: { chat: TelegramChatDto }) {
  return (
    <article className="co-chat-card">
      <div>
        <span className="co-overline">{chat.type}</span>
        <strong>{chat.title}</strong>
        <p>{chat.handle ?? 'Private'} · {chat.activeMembers} active · {chat.accessMode.replace('_', ' ')}</p>
      </div>
      <span className={`co-state ${chat.botStatus === 'admin' ? 'granted' : 'failed'}`}>{chat.botStatus.replace('_', ' ')}</span>
    </article>
  )
}

export function PlanCard({ plan }: { plan: PlanDto }) {
  return (
    <article className="co-plan-card">
      <div>
        <strong>{plan.name}</strong>
        <p>{plan.description ?? `${plan.interval} membership`}</p>
      </div>
      <div>
        <strong>{plan.stars ? `${plan.stars} XTR` : 'Free'}</strong>
        <span>{plan.subscribers} members</span>
      </div>
    </article>
  )
}

export function ReferralCampaignCard({ campaign }: { campaign: ReferralCampaignDto }) {
  return (
    <article className="co-campaign-card">
      <div className="co-card-topline">
        <span className={`co-state ${campaign.status === 'active' ? 'granted' : 'pending'}`}>{campaign.status}</span>
        <span>{money(campaign.revenueCents)}</span>
      </div>
      <strong>{campaign.title}</strong>
      <p>{campaign.reward}</p>
      <div className="co-mini-grid">
        <span>{campaign.clicks}<small>clicks</small></span>
        <span>{campaign.joins}<small>joins</small></span>
        <span>{campaign.purchases}<small>buys</small></span>
      </div>
    </article>
  )
}

export function RewardRuleCard({ rule }: { rule: RewardRuleDto }) {
  return (
    <article className="co-rule-card">
      <span className={`co-state ${rule.status === 'active' ? 'granted' : 'pending'}`}>{rule.status}</span>
      <strong>{rule.title}</strong>
      <p>{rule.trigger}</p>
      <em>{rule.reward}</em>
    </article>
  )
}
