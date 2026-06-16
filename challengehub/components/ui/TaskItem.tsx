import { useState } from 'react'
import { TaskDto } from '@/lib/api-client'
import { getCategoryMeta } from '@/lib/categories'
import { getTaskStatus } from '@/lib/task-status'
import { haptic } from '@/lib/telegram-webapp'
import CheckinPanel, { TaskSubmitResult } from './CheckinPanel'

export type { TaskSubmitResult }

export default function TaskItem({
  task,
  category,
  challengeStartDate,
  canSubmit,
  onSubmitted,
}: {
  task: TaskDto
  category?: string
  challengeStartDate?: string
  canSubmit: boolean
  onSubmitted: (result: TaskSubmitResult) => void
}) {
  const done = !!task.submission
  const meta = getCategoryMeta(category)
  const status = getTaskStatus(task, challengeStartDate)
  const missed = status === 'missed'
  const clickable = !done && canSubmit

  const [expanded, setExpanded] = useState(false)

  const toggleExpand = () => {
    if (!clickable) return
    haptic('light')
    setExpanded((e) => !e)
  }

  const xpDisplay = missed ? Math.max(1, Math.round(task.xpReward * 0.5)) : task.xpReward

  return (
    <div className={`task-item-wrap ${expanded ? 'expanded' : ''}`}>
      <div
        className={`task-item ${done ? 'done' : ''} ${missed ? 'missed' : ''} ${clickable ? 'clickable' : ''}`}
        onClick={toggleExpand}
      >
        <div className={`task-item-day ${done ? '' : meta.className}`}>{done ? '✓' : missed ? '!' : task.day}</div>
        <div className="task-item-body">
          <div className="task-item-title">{task.title}</div>
          {task.description && <div className="task-item-desc">{task.description}</div>}
          {missed && <div className="task-item-missed-label">Missed — catch up for partial XP</div>}
        </div>
        {done ? (
          <span className="task-item-check">✓</span>
        ) : (
          <span className={`task-item-xp ${missed ? 'catchup' : ''}`}>+{xpDisplay} XP</span>
        )}
      </div>

      {expanded && (
        <CheckinPanel
          task={task}
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
