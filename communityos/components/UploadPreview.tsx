export function UploadBox({ label, preview, fileName, accept, onFile }: { label: string; preview?: string | null; fileName?: string | null; accept: string; onFile: (file: File | null) => void }) {
  return (
    <label className="tg-upload-card">
      <input type="file" accept={accept} onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)} />
      <div>{preview ? <span className="tg-cover-preview" style={{ backgroundImage: `url(${preview})` }} /> : <span>{label}</span>}</div>
      {fileName && <small>{fileName}</small>}
    </label>
  )
}

export function PreviewCard({ title, description, buttonText, coverUrl }: { title: string; description: string; buttonText: string; coverUrl?: string | null }) {
  return (
    <div className="tg-message-preview">
      <div className={coverUrl ? 'tg-preview-cover has-image' : 'tg-preview-cover'}>
        {coverUrl ? <span style={{ backgroundImage: `url(${coverUrl})` }} /> : <span>CommunityOS</span>}
      </div>
      <div className="tg-preview-body">
        <small>Telegram preview</small>
        <strong>{title}</strong>
        <p>{description}</p>
        <button type="button">{buttonText}</button>
      </div>
    </div>
  )
}
