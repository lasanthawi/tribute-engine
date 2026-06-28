export type ConfirmDialogState = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  onClose,
}: ConfirmDialogState & { onClose: () => void }) {
  return (
    <div className="tg-action-sheet-overlay" onClick={onClose}>
      <div className="tg-action-sheet" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" className={destructive ? 'destructive' : undefined} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
