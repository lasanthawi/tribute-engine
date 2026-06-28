import { DashboardDto, MemberRowDto, TelegramChatDto } from '@/lib/api-client'
import { dateShort, initials } from '@/lib/format'
import { haptic } from '@/lib/telegram-webapp'
import { IconName, RowIcon } from '@/components/icons'

export function ListGroup({ children }: { children: React.ReactNode }) {
  return <div className="tg-list-group">{children}</div>
}

export function CheckoutPrompt({
  tone,
  eyebrow,
  title,
  detail,
  secondary,
  imageUrl,
  meta,
  cta,
  onClick,
}: {
  tone: 'blue' | 'red' | 'purple' | 'green' | 'amber'
  eyebrow: string
  title: string
  detail: string
  secondary?: string | null
  imageUrl?: string | null
  meta: string
  cta: string
  onClick: () => void
}) {
  return (
    <section className={`tg-checkout-prompt ${tone}`}>
      <div className="tg-checkout-prompt-body">
        {imageUrl && <span className="tg-checkout-prompt-thumb" style={{ backgroundImage: `url(${imageUrl})` }} />}
        <div>
          <small>{eyebrow}</small>
          <h2>{title}</h2>
          <p>{detail}</p>
          {secondary && <span className="tg-checkout-prompt-secondary">{secondary}</span>}
        </div>
      </div>
      <strong>{meta}</strong>
      <button type="button" onClick={onClick}>
        {cta}
      </button>
    </section>
  )
}

export function ListRow({
  title,
  detail,
  meta,
  icon,
  avatar,
  image,
  tone = 'blue',
  onClick,
}: {
  title: string
  detail?: string
  meta?: string
  icon?: IconName
  avatar?: string
  image?: string | null
  tone?: 'blue' | 'red' | 'purple' | 'green' | 'amber'
  onClick?: () => void
}) {
  const content = (
    <>
      {image ? (
        <span className="tg-row-icon-image" style={{ backgroundImage: `url(${image})` }} />
      ) : avatar ? (
        <span className={`tg-row-icon ${tone}`}>{avatar}</span>
      ) : icon ? (
        <span className={`tg-row-glyph ${tone}`}>
          <RowIcon name={icon} />
        </span>
      ) : null}
      <span className="tg-row-main">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      {meta && <em>{meta}</em>}
      {onClick && <b aria-hidden="true">›</b>}
    </>
  )

  if (onClick) {
    return (
      <button
        className="tg-list-row"
        type="button"
        onClick={() => {
          haptic('light')
          onClick()
        }}
      >
        {content}
      </button>
    )
  }

  return <div className="tg-list-row">{content}</div>
}

export function paymentStatusBadge(status: string): { label: string; tone: 'green' | 'amber' | 'muted' } | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return { label: 'Paid', tone: 'green' }
    case 'past_due':
      return { label: 'Pending', tone: 'amber' }
    case 'expired':
    case 'cancelled':
      return { label: 'Unpaid', tone: 'muted' }
    default:
      return null
  }
}

export function MemberRow({
  member,
  onGrant,
  onRevoke,
  onSuspend,
  onRestore,
  compact,
}: {
  member: MemberRowDto
  onGrant: () => void
  onRevoke: () => void
  onSuspend?: () => void
  onRestore?: () => void
  compact?: boolean
}) {
  const payment = paymentStatusBadge(member.subscriptionStatus)
  return (
    <article className={`tg-member-row ${compact ? 'compact' : ''}`}>
      <span className="tg-row-glyph blue">
        <RowIcon name="member" />
      </span>
      <div>
        <strong>@{member.username}</strong>
        <small>
          {member.planName ?? 'No plan'} · {member.accessStatus} · {member.xp} XP
        </small>
        {payment && <span className={`tg-status-chip ${payment.tone}`}>{payment.label}</span>}
      </div>
      <div className="tg-member-actions">
        {member.accessStatus === 'granted' ? (
          <>
            <button type="button" onClick={onSuspend ?? onRevoke}>Suspend</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        ) : member.accessStatus === 'suspended' ? (
          <>
            <button type="button" onClick={onRestore ?? onGrant}>Restore</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onGrant}>Grant</button>
            <button type="button" onClick={onRevoke}>Remove</button>
          </>
        )}
      </div>
    </article>
  )
}

export function JoinRequestRow({
  request,
  onApprove,
  onDecline,
}: {
  request: DashboardDto['joinRequests'][number]
  onApprove: () => void
  onDecline: () => void
}) {
  return (
    <article className="tg-member-row compact">
      <span className="tg-row-glyph green">
        <RowIcon name="member" />
      </span>
      <div>
        <strong>@{request.username ?? request.telegramUserId}</strong>
        <small>
          Join request · {request.referralCode ? `ref ${request.referralCode}` : dateShort(request.createdAt)}
        </small>
      </div>
      <div className="tg-member-actions">
        <button type="button" onClick={onApprove}>Approve</button>
        <button type="button" onClick={onDecline}>Decline</button>
      </div>
    </article>
  )
}

export function ChatRow({ chat, image }: { chat: TelegramChatDto; image?: string | null }) {
  const status = chat.botStatus === 'admin' ? 'Ready' : chat.botStatus === 'missing_permissions' ? 'Needs permissions' : 'Not connected'
  return (
    <ListRow
      tone={chat.botStatus === 'admin' ? 'green' : 'amber'}
      icon={chat.type === 'channel' ? 'channel' : 'group'}
      image={image}
      title={chat.title}
      detail={`${chat.type}. ${chat.activeMembers} active members`}
      meta={status}
    />
  )
}

export function AvatarMark({ className, image, label }: { className: string; image?: string | null; label: string }) {
  return (
    <span className={`${className} ${image ? 'has-image' : ''}`}>
      {image ? <img src={image} alt="" /> : initials(label)}
    </span>
  )
}

export function StoryArt({
  label,
  compact,
  imageUrl,
  icon,
}: {
  label: string
  compact?: boolean
  imageUrl?: string | null
  icon?: IconName
}) {
  return (
    <div className={`tg-story-art ${compact ? 'compact' : ''}`} aria-hidden="true">
      <span className={`tg-story-art-card ${imageUrl ? 'has-image' : ''} ${!imageUrl && icon ? 'has-icon' : ''}`}>
        {imageUrl ? (
          <img src={imageUrl} alt="" />
        ) : icon ? (
          <RowIcon name={icon} />
        ) : (
          <><i /><b>{label}</b></>
        )}
      </span>
    </div>
  )
}

export function ActionTile({ label, icon, onClick }: { label: string; icon: 'edit' | 'copy' | 'share' | 'more'; onClick: () => void }) {
  return (
    <button
      className="tg-action-tile"
      type="button"
      onClick={() => {
        haptic('light')
        onClick()
      }}
    >
      <span className="tg-action-icon" aria-hidden="true">
        <RowIcon name={icon} />
      </span>
      <strong>{label}</strong>
    </button>
  )
}

export function ActionSheet({
  kind,
  productStatus,
  onDuplicate,
  onToggleStatus,
  onClose,
}: {
  kind: 'plan' | 'product' | 'event'
  productStatus?: 'draft' | 'active'
  onDuplicate: () => void
  onToggleStatus?: () => void
  onClose: () => void
}) {
  const kindLabel = kind === 'plan' ? 'Membership' : kind === 'product' ? 'Product' : 'Event'
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label="More Options" onClick={(event) => event.stopPropagation()}>
        <h2>More Options</h2>
        <p>{kindLabel} actions</p>
        {onToggleStatus && (
          <button type="button" onClick={onToggleStatus}>
            {productStatus === 'active' ? 'Move to Draft' : 'Publish'}
          </button>
        )}
        <button type="button" onClick={onDuplicate}>
          Duplicate {kindLabel}
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function FixedButton({
  label,
  onClick,
  submit,
  disabled,
}: {
  label: string
  onClick?: () => void
  submit?: boolean
  disabled?: boolean
}) {
  return (
    <div className="tg-fixed-button">
      <button
        type={submit ? 'submit' : 'button'}
        onClick={() => {
          haptic('medium')
          onClick?.()
        }}
        disabled={disabled}
      >
        {disabled && <span className="tg-button-spinner" aria-hidden="true" />}
        {disabled ? 'Working…' : label}
      </button>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="tg-section-label">{children}</h2>
}

export function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="tg-empty-block">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}
