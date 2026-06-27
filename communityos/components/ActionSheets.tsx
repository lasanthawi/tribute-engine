export function AddCommunityActionSheet({
  onChooseGroup,
  onChooseChannel,
  onClose,
}: {
  onChooseGroup: () => void
  onChooseChannel: () => void
  onClose: () => void
}) {
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label="Add Community" onClick={(event) => event.stopPropagation()}>
        <h2>Add Community</h2>
        <p>Connect a Telegram group or a channel. Keep all requested admin rights enabled so access control works.</p>
        <button type="button" onClick={onChooseGroup}>
          Add a Group or Supergroup
        </button>
        <button type="button" onClick={onChooseChannel}>
          Add a Channel
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function SupportActionSheet({
  onMessageAdmin,
  onMessageBot,
  onOpenChannel,
  onClose,
}: {
  onMessageAdmin?: () => void
  onMessageBot: () => void
  onOpenChannel?: () => void
  onClose: () => void
}) {
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label="Get Support" onClick={(event) => event.stopPropagation()}>
        <h2>Get Support</h2>
        <p>How would you like to reach out?</p>
        {onMessageAdmin && (
          <button type="button" onClick={onMessageAdmin}>
            Message Community Admin
          </button>
        )}
        <button type="button" onClick={onMessageBot}>
          Message Support Bot
        </button>
        {onOpenChannel && (
          <button type="button" onClick={onOpenChannel}>
            Open Community Channel
          </button>
        )}
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
