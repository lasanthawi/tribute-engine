export default function ProgressBar({
  label,
  done,
  total,
}: {
  label: string
  done: number
  total: number
}) {
  const progress = total > 0 ? Math.min(1, done / total) : 0

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-label">
        <span>{label}</span>
        <span>
          {done} / {total}
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${Math.max(progress > 0 ? 4 : 0, progress * 100)}%` }} />
      </div>
    </div>
  )
}
