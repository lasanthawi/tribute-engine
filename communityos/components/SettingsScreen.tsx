import { FormEvent, useState } from 'react'
import { DashboardDto } from '@/lib/api-client'
import { haptic } from '@/lib/telegram-webapp'
import { ConfirmDialogState } from '@/components/ConfirmSheet'
import { ChatRow, EmptyBlock, ListGroup, ListRow, SectionLabel } from '@/components/ListPrimitives'

export function SettingsScreen({
  data,
  onUpdateSetting,
  onUpdateStatus,
  onPromoteAdmin,
  onDemoteAdmin,
  onRequestConfirm,
}: {
  data: DashboardDto
  onUpdateSetting: (partial: Partial<{ starsCheckoutEnabled: boolean; notificationsEnabled: boolean }>) => void
  onUpdateStatus: (status: 'active' | 'paused' | 'archived') => void
  onPromoteAdmin: (userId: number) => void
  onDemoteAdmin: (userId: number) => void
  onRequestConfirm: (options: ConfirmDialogState) => void
}) {
  const settings = data.community.settings ?? { starsCheckoutEnabled: true, notificationsEnabled: true }
  const status = data.community.status
  const admins = data.members.filter((member) => member.role !== 'member')
  const candidates = data.members.filter((member) => member.role === 'member')
  const [candidateId, setCandidateId] = useState('')

  function handleAddAdmin(event: FormEvent) {
    event.preventDefault()
    if (!candidateId) return
    haptic('medium')
    onPromoteAdmin(Number(candidateId))
    setCandidateId('')
  }

  return (
    <section className="tg-screen">
      <h1 className="tg-left-title">Settings</h1>
      {status !== 'active' && (
        <section className="tg-callout">
          <span>{status === 'archived' ? 'ARCHIVED' : 'PAUSED'}</span>
          <h2>{status === 'archived' ? 'This community is archived' : 'This community is paused'}</h2>
          <p>Members can&apos;t access new content until you reactivate it.</p>
          <button
            type="button"
            onClick={() => {
              haptic('medium')
              onRequestConfirm({
                title: 'Reactivate community',
                message: 'Reactivate this community? Members will regain access immediately.',
                confirmLabel: 'Reactivate',
                onConfirm: () => onUpdateStatus('active'),
              })
            }}
          >
            Reactivate community
          </button>
        </section>
      )}
      <SectionLabel>Bot connection</SectionLabel>
      <ListGroup>
        {data.chats.map((chat) => <ChatRow key={chat.id} chat={chat} image={data.community.avatarUrl} />)}
        {data.chats.length === 0 && <EmptyBlock title="No group connected" detail="Add the bot as admin in a Telegram group or channel, then share a membership to confirm the connection." />}
      </ListGroup>
      <SectionLabel>Checkout and notifications</SectionLabel>
      <ListGroup>
        <ListRow
          tone={settings.starsCheckoutEnabled ? 'green' : 'amber'}
          icon="stars"
          title="Stars checkout"
          detail="Let members pay with Telegram Stars"
          meta={settings.starsCheckoutEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ starsCheckoutEnabled: !settings.starsCheckoutEnabled })}
        />
        <ListRow
          tone={settings.notificationsEnabled ? 'green' : 'amber'}
          icon="comment"
          title="Notifications"
          detail="Bot messages for renewals, access changes, and join requests"
          meta={settings.notificationsEnabled ? 'on' : 'off'}
          onClick={() => onUpdateSetting({ notificationsEnabled: !settings.notificationsEnabled })}
        />
      </ListGroup>
      <SectionLabel>Admins</SectionLabel>
      <ListGroup>
        {admins.map((member) => (
          <ListRow
            key={member.id}
            tone={member.role === 'owner' ? 'blue' : 'green'}
            icon="member"
            title={`@${member.username}`}
            detail={member.role === 'owner' ? 'Owner' : 'Admin'}
            onClick={
              member.role === 'admin'
                ? () =>
                    onRequestConfirm({
                      title: 'Remove admin',
                      message: `Remove admin access for @${member.username}? They'll keep their membership but lose admin tools.`,
                      confirmLabel: 'Remove',
                      destructive: true,
                      onConfirm: () => onDemoteAdmin(member.id),
                    })
                : undefined
            }
          />
        ))}
        {admins.length === 0 && <EmptyBlock title="No admins yet" detail="Promote a trusted member to help manage this community." />}
      </ListGroup>
      {candidates.length > 0 && (
        <form className="tg-form-card" onSubmit={handleAddAdmin}>
          <div className="tg-input-group">
            <label>
              <span>Add admin</span>
              <select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                <option value="">Choose a member…</option>
                {candidates.map((member) => (
                  <option key={member.id} value={member.id}>
                    @{member.username}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" disabled={!candidateId}>Make admin</button>
        </form>
      )}
      {status === 'active' && (
        <>
          <SectionLabel>Danger zone</SectionLabel>
          <ListGroup>
            <ListRow
              tone="amber"
              icon="settings"
              title="Pause community"
              detail="Temporarily block new member access. You can reactivate anytime."
              onClick={() =>
                onRequestConfirm({
                  title: 'Pause community',
                  message: 'Pause this community? Members will lose access to new content until you reactivate it.',
                  confirmLabel: 'Pause',
                  onConfirm: () => onUpdateStatus('paused'),
                })
              }
            />
            <ListRow
              tone="red"
              icon="delete"
              title="Archive community"
              detail="Hide this community and stop all member access."
              onClick={() =>
                onRequestConfirm({
                  title: 'Archive community',
                  message:
                    'Archive this community? This stops all member access and hides it from your account. This is hard to undo — only continue if you are sure.',
                  confirmLabel: 'Archive',
                  destructive: true,
                  onConfirm: () => onUpdateStatus('archived'),
                })
              }
            />
          </ListGroup>
        </>
      )}
    </section>
  )
}
