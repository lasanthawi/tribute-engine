import { useState } from 'react'
import Link from 'next/link'
import { ChallengeDto, TaskDto } from '@/lib/api-client'
import { getCategoryMeta } from '@/lib/categories'
import { getTaskStatus, getSpotlightStatusInfo } from '@/lib/task-status'
import { haptic } from '@/lib/telegram-webapp'
import CheckinPanel, { TaskSubmitResult } from './CheckinPanel'

export default function SpotlightCard({
  challenge,
  tasks,
  onSubmitted,
}: {
  challenge: ChallengeDto
  tasks: TaskDto[] | null
  onSubmitted: (result: TaskSubmitResult) => void
}) {
  const meta = getCategoryMeta(challenge.category)
  const catClass = `cat-${meta.className.replace('cat-', '')}`
  const [showModal, setShowModal] = useState(false)

  const sorted = tasks ? [...tasks].sort((a, b) => a.day - b.day) : null
  const nextTask = sorted?.find((t) => !t.submission) ?? null
  const allDone = !!sorted && sorted.length > 0 && !nextTask
  const missed = nextTask ? getTaskStatus(nextTask, challenge.startDate) === 'missed' : false
  const statusInfo = nextTask ? getSpotlightStatusInfo(nextTask, challenge.startDate) : null

  const openModal = () => {
    haptic('light')
    setShowModal(true)
  }

  return (
    <>
      <div className={`spotlight-card ${catClass}`}>
        <Link href={`/challenge/${challenge.id}`} className="spotlight-link">
          <div className="spotlight-eyebrow">{challenge.isMember ? 'Continue your challenge' : 'Featured challenge'}</div>
          <div className="spotlight-icon">{meta.icon}</div>
          <h2 className="spotlight-title">{challenge.title}</h2>
          <p className="spotlight-desc">{challenge.description}</p>
        </Link>

        {!challenge.isMember && (
          <Link href={`/challenge/${challenge.id}`} className="spotlight-cta">
            Join now →
          </Link>
        )}

        {challenge.isMember && nextTask && statusInfo && (
          <div className="spotlight-task">
            <div className="spotlight-task-info">
              <span className={`spotlight-task-status ${statusInfo.cls}`}>{statusInfo.label}</span>
              <span className="spotlight-task-title">Day {nextTask.day} · {nextTask.title}</span>
            </div>
            <button type="button" className="spotlight-checkin-btn" onClick={openModal}>
              Check in
            </button>
          </div>
        )}

        {challenge.isMember && allDone && (
          <div className="spotlight-task-done">🎉 All caught up — nice work!</div>
        )}
      </div>

      {showModal && nextTask && (
        <div className="checkin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="checkin-modal-handle" />
            <div className="checkin-modal-header">
              <div className="checkin-modal-challenge">{challenge.title}</div>
              <button className="checkin-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <CheckinPanel
              task={nextTask}
              missed={missed}
              onSubmitted={(result) => {
                setShowModal(false)
                onSubmitted(result)
              }}
              onCancel={() => setShowModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
