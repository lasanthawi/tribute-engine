import { TaskDto } from './api-client'

export type TaskStatus = 'done' | 'missed' | 'today' | 'upcoming'

/** The calendar date a given challenge day falls on (day 1 = challenge start date). */
export function dueDateForDay(challengeStartDate: string, day: number): Date {
  const d = new Date(challengeStartDate)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + (day - 1))
  return d
}

export function getTaskStatus(task: TaskDto, challengeStartDate?: string): TaskStatus {
  if (task.submission) return 'done'
  if (!challengeStartDate) return 'upcoming'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = dueDateForDay(challengeStartDate, task.day)

  if (due.getTime() < today.getTime()) return 'missed'
  if (due.getTime() === today.getTime()) return 'today'
  return 'upcoming'
}
