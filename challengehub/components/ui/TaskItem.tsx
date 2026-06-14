import { TaskDto } from '@/lib/api-client'

export default function TaskItem({
  task,
  onSelect,
}: {
  task: TaskDto
  onSelect?: (task: TaskDto) => void
}) {
  const done = !!task.submission

  return (
    <div className={`task-item ${done ? 'done' : ''}`} onClick={() => !done && onSelect?.(task)}>
      <div className="task-item-day">{done ? '✓' : task.day}</div>
      <div className="task-item-body">
        <div className="task-item-title">{task.title}</div>
        {task.description && <div className="task-item-desc">{task.description}</div>}
      </div>
      {done ? <span className="task-item-check">✓</span> : <span className="task-item-xp">+{task.xpReward} XP</span>}
    </div>
  )
}
