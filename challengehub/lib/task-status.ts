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

/** Days from today until the task's due date (positive = future, 0 = today, negative = past). */
export function getDaysUntil(challengeStartDate: string, day: number): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = dueDateForDay(challengeStartDate, day)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export interface StatusInfo {
  label: string
  cls: 'missed' | 'today' | 'soon' | 'upcoming'
}

export function getSpotlightStatusInfo(task: TaskDto, challengeStartDate?: string): StatusInfo {
  const status = getTaskStatus(task, challengeStartDate)
  if (status === 'missed') return { label: 'Delayed', cls: 'missed' }
  if (status === 'today') return { label: 'Today', cls: 'today' }

  const days = challengeStartDate ? getDaysUntil(challengeStartDate, task.day) : null
  if (days === 1) return { label: 'Tomorrow', cls: 'soon' }
  if (days !== null && days <= 3) return { label: `In ${days} days · Reminder`, cls: 'soon' }
  if (days !== null) return { label: `In ${days} days`, cls: 'upcoming' }
  return { label: 'Upcoming', cls: 'upcoming' }
}
