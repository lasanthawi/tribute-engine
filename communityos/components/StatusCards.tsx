import { DashboardDto } from '@/lib/api-client'
import { haptic } from '@/lib/telegram-webapp'
import { IconName, RowIcon } from '@/components/icons'
import { AvatarMark } from '@/components/ListPrimitives'

export type ConnectStatus =
  | { phase: 'connecting'; kind: 'group' | 'channel' }
  | { phase: 'success'; name: string }
  | { phase: 'needs_permissions'; name: string }
  | { phase: 'timeout'; kind: 'group' | 'channel' }

export function NextActionCard({
  title,
  detail,
  cta,
  icon,
  onClick,
}: {
  title: string
  detail: string
  cta: string
  icon: IconName
  onClick: () => void
}) {
  return (
    <section className="tg-callout">
      <div className="tg-next-action-head">
        <span className="tg-next-action-icon">
          <RowIcon name={icon} />
        </span>
        <span>NEXT ACTION</span>
      </div>
      <h2>{title}</h2>
      <p>{detail}</p>
      <button
        type="button"
        onClick={() => {
          haptic('medium')
          onClick()
        }}
      >
        {cta}
      </button>
    </section>
  )
}

export function ConnectStatusCard({
  status,
  onDismiss,
  onRetry,
}: {
  status: ConnectStatus
  onDismiss: () => void
  onRetry: () => void
}) {
  const tone = status.phase === 'success' ? 'success' : status.phase === 'connecting' ? 'info' : 'warning'
  const title =
    status.phase === 'connecting'
      ? `Connecting your ${status.kind}…`
      : status.phase === 'success'
      ? `${status.name} connected`
      : status.phase === 'needs_permissions'
      ? `${status.name} needs admin rights`
      : `Still waiting on your ${status.kind}`
  const detail =
    status.phase === 'connecting'
      ? status.kind === 'channel'
        ? 'Pick your channel and keep all requested admin rights enabled — this card updates automatically.'
        : 'Add the bot as admin in your group — this card updates automatically.'
      : status.phase === 'success'
      ? 'Paying members will receive invite links automatically.'
      : status.phase === 'needs_permissions'
      ? 'Promote the bot to admin in Telegram so CommunityOS can manage access.'
      : "We didn't see a new community yet. If you finished in Telegram, check again."

  return (
    <section className={`tg-callout tg-connect-status tg-connect-status--${tone}`}>
      <div className="tg-next-action-head">
        <span className="tg-next-action-icon">
          <RowIcon name={status.phase === 'needs_permissions' || status.phase === 'timeout' ? 'access' : 'bot'} />
        </span>
        <span>{status.phase === 'connecting' ? 'CONNECTING' : 'TELEGRAM'}</span>
      </div>
      <h2>{title}</h2>
      <p>{detail}</p>
      <button
        type="button"
        onClick={() => {
          haptic('medium')
          if (status.phase === 'timeout') onRetry()
          else onDismiss()
        }}
      >
        {status.phase === 'connecting' ? 'Cancel' : status.phase === 'timeout' ? 'Check again' : 'Dismiss'}
      </button>
    </section>
  )
}

export function RevenueSnapshotRow({
  items,
}: {
  items: { key: string; icon: IconName; label: string; count?: number; onClick: () => void }[]
}) {
  return (
    <div className="tg-revenue-grid">
      {items.map((item) => (
        <button
          key={item.key}
          className="tg-revenue-card"
          type="button"
          onClick={() => {
            haptic('light')
            item.onClick()
          }}
        >
          <span className="tg-revenue-icon">
            <RowIcon name={item.icon} />
          </span>
          {typeof item.count === 'number' && <strong>{item.count}</strong>}
          <small>{item.label}</small>
        </button>
      ))}
    </div>
  )
}

export function QuickAccessRow({
  items,
}: {
  items: { key: string; icon: IconName; label: string; badge?: number; onClick: () => void }[]
}) {
  return (
    <div className="tg-quick-access-row">
      {items.map((item) => (
        <button
          key={item.key}
          className="tg-quick-access-chip"
          type="button"
          onClick={() => {
            haptic('light')
            item.onClick()
          }}
        >
          <RowIcon name={item.icon} />
          <span>{item.label}</span>
          {typeof item.badge === 'number' && item.badge > 0 && <strong>{item.badge}</strong>}
        </button>
      ))}
    </div>
  )
}

export function CommunityHeader({ data, onEdit }: { data: DashboardDto; onEdit?: () => void }) {
  return (
    <section className="tg-community-header">
      <div className="tg-avatar-wrap">
        <AvatarMark className="tg-large-avatar" image={data.community.avatarUrl} label={data.community.name} />
        <button
          className="tg-header-edit-button"
          type="button"
          onClick={() => {
            haptic('light')
            onEdit?.()
          }}
          title="Edit profile"
        >
          ✎
        </button>
      </div>
      <h1>{data.community.name}</h1>
      <p>{data.metrics.members} members</p>
      <div className="tg-mini-stats">
        <span>{data.metrics.monthlyStars.toLocaleString()} XTR</span>
        <span>{data.metrics.healthScore || data.ai.healthScore}% health</span>
      </div>
    </section>
  )
}
