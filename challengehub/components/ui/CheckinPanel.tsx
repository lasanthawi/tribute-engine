import { ChangeEvent, useRef, useState } from 'react'
import { api, TaskDto } from '@/lib/api-client'
import { haptic, hapticNotify } from '@/lib/telegram-webapp'

type EvidenceType = 'text' | 'screenshot' | 'voice' | 'link'

const EVIDENCE_OPTIONS: { type: EvidenceType; icon: string; label: string }[] = [
  { type: 'text', icon: '📝', label: 'Note' },
  { type: 'screenshot', icon: '📸', label: 'Photo' },
  { type: 'voice', icon: '🎙️', label: 'Voice' },
  { type: 'link', icon: '🔗', label: 'Link' },
]

export interface TaskSubmitResult {
  xpAwarded: number
  leveledUp: boolean
  newLevel: number
  isCatchup: boolean
}

export default function CheckinPanel({
  task,
  missed,
  onSubmitted,
  onCancel,
}: {
  task: TaskDto
  missed: boolean
  onSubmitted: (result: TaskSubmitResult) => void
  onCancel: () => void
}) {
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('text')
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<'image' | 'audio' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const uploadDataUrl = async (dataUrl: string, kind: 'image' | 'audio') => {
    setUploading(true)
    setError(null)
    try {
      const { url } = await api.uploadEvidence(dataUrl)
      setMediaUrl(url)
      setMediaKind(kind)
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => uploadDataUrl(reader.result as string, 'image')
    reader.readAsDataURL(file)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => uploadDataUrl(reader.result as string, 'audio')
        reader.readAsDataURL(blob)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      haptic('medium')
    } catch {
      setError('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    haptic('light')
  }

  const selectEvidenceType = (type: EvidenceType) => {
    haptic('light')
    setError(null)
    if (type === 'screenshot') {
      setEvidenceType(type)
      fileInputRef.current?.click()
      return
    }
    if (type === 'voice') {
      setEvidenceType(type)
      if (recording) stopRecording()
      else startRecording()
      return
    }
    setEvidenceType(type)
  }

  const handleSubmit = async () => {
    setError(null)

    let evidenceContent: string | undefined
    if (evidenceType === 'text') {
      evidenceContent = text || undefined
    } else if (evidenceType === 'link') {
      if (!link.trim()) {
        setError('Please paste a link')
        return
      }
      evidenceContent = link.trim()
    } else {
      if (!mediaUrl) {
        setError(`Please attach a ${evidenceType === 'screenshot' ? 'photo' : 'voice note'} first`)
        return
      }
      evidenceContent = mediaUrl
    }

    setSubmitting(true)
    try {
      const res = await api.submitTask(task.id, { evidenceType, evidenceContent, isCatchup: missed })
      hapticNotify('success')
      onSubmitted({ xpAwarded: res.xpAwarded, leveledUp: res.leveledUp, newLevel: res.newLevel, isCatchup: missed })
    } catch (e: any) {
      hapticNotify('error')
      setError(e.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const xpDisplay = missed ? Math.max(1, Math.round(task.xpReward * 0.5)) : task.xpReward

  return (
    <div className="checkin-form card-in">
      <div className="task-item-title" style={{ marginBottom: 10 }}>
        {missed ? `Catch up: ${task.title}` : `Check in: ${task.title}`}
      </div>

      <div className="evidence-picker">
        {EVIDENCE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            className={`evidence-btn ${evidenceType === opt.type ? 'active' : ''} ${
              opt.type === 'voice' && recording ? 'recording' : ''
            }`}
            onClick={() => selectEvidenceType(opt.type)}
          >
            <span className="evidence-btn-icon">{opt.type === 'voice' && recording ? '⏹️' : opt.icon}</span>
            <span>{opt.type === 'voice' && recording ? 'Stop' : opt.label}</span>
          </button>
        ))}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFileChange} />

      {evidenceType === 'text' && (
        <textarea
          className="checkin-textarea"
          placeholder="Describe what you did today (optional)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      {evidenceType === 'link' && (
        <input
          className="evidence-link-input"
          placeholder="https://…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      )}

      {(evidenceType === 'screenshot' || evidenceType === 'voice') && (
        <>
          {uploading && <div className="evidence-uploading">Uploading…</div>}
          {!uploading && recording && <div className="evidence-uploading">Recording… tap Stop when done</div>}
          {mediaUrl && mediaKind === 'image' && (
            <div className="evidence-preview">
              <img src={mediaUrl} alt="Evidence" />
            </div>
          )}
          {mediaUrl && mediaKind === 'audio' && (
            <div className="evidence-preview">
              <audio controls src={mediaUrl} />
            </div>
          )}
        </>
      )}

      {error && <div style={{ color: 'var(--error)', fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <button className="btn-primary" onClick={handleSubmit} disabled={submitting || uploading} style={{ marginBottom: 8 }}>
        {submitting ? 'Submitting…' : missed ? `Catch Up (+${xpDisplay} XP)` : `Submit Check-in (+${xpDisplay} XP)`}
      </button>
      <button className="btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
