import { TaskDto } from '@/lib/api-client'
import { getCategoryMeta } from '@/lib/categories'

export default function TaskItem({
  task,
  category,
  onSelect,
}: {
  task: TaskDto
  category?: string
  onSelect?: (task: TaskDto) => void
}) {
  const done = !!task.submission
  const meta = getCategoryMeta(category)

  return (
    <div className={`task-item ${done ? 'done' : ''}`} onClick={() => !done && onSelect?.(task)}>
      <div className={`task-item-day ${done ? '' : meta.className}`}>{done ? '✓' : task.day}</div>
      <div className="task-item-body">
        <div className="task-item-title">{task.title}</div>
        {task.description && <div className="task-item-desc">{task.description}</div>}
      </div>
      {done ? <span className="task-item-check">✓</span> : <span className="task-item-xp">+{task.xpReward} XP</span>}
    </div>
  )
}
