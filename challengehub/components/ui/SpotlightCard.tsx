import { useState } from 'react'
import Link from 'next/link'
import { ChallengeDto, TaskDto } from '@/lib/api-client'
import { getCategoryMeta } from '@/lib/categories'
import { getTaskStatus } from '@/lib/task-status'
import { haptic } from '@/lib/telegram-webapp'
import CheckinPanel, { TaskSubmitResult } from './CheckinPanel'

const STATUS_LABEL: Record<string, string> = {
  missed: 'Missed',
  today: 'Due today',
  upcoming: 'Up next',
}

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
  const [expanded, setExpanded] = useState(false)

  const sorted = tasks ? [...tasks].sort((a, b) => a.day - b.day) : null
  const nextTask = sorted?.find((t) => !t.submission) ?? null
  const allDone = !!sorted && sorted.length > 0 && !nextTask
  const status = nextTask ? getTaskStatus(nextTask, challenge.startDate) : null
  const missed = status === 'missed'

  const toggleCheckin = () => {
    haptic('light')
    setExpanded((e) => !e)
  }

  return (
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

      {challenge.isMember && nextTask && status && (
        <div className="spotlight-task">
          <div className="spotlight-task-info">
            <span className={`spotlight-task-status ${status}`}>{STATUS_LABEL[status] ?? `Day ${nextTask.day}`}</span>
            <span className="spotlight-task-title">{nextTask.title}</span>
          </div>
          <button type="button" className="spotlight-checkin-btn" onClick={toggleCheckin}>
            {expanded ? 'Close' : 'Check in'}
          </button>
        </div>
      )}

      {challenge.isMember && allDone && <div className="spotlight-task-done">🎉 All caught up — nice work!</div>}

      {challenge.isMember && !expanded && (
        <Link href={`/challenge/${challenge.id}`} className="spotlight-cta">
          {nextTask ? 'View all tasks →' : 'View challenge →'}
        </Link>
      )}

      {challenge.isMember && expanded && nextTask && (
        <CheckinPanel
          task={nextTask}
          missed={missed}
          onSubmitted={(result) => {
            setExpanded(false)
            onSubmitted(result)
          }}
          onCancel={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
