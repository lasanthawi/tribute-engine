import { supabase } from './supabase'

const MAX_MULTIPLIER = 2.0
const MULTIPLIER_STEP = 0.1

/** streak_multiplier = 1.0, then +0.1 per consecutive correct day, capped at 2.0 */
export function getStreakMultiplier(streakCount: number): number {
  return Math.min(MAX_MULTIPLIER, 1.0 + MULTIPLIER_STEP * streakCount)
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isYesterday(lastDay: string, today: string): boolean {
  const last = new Date(`${lastDay}T00:00:00Z`)
  const todayDate = new Date(`${today}T00:00:00Z`)
  const diffDays = (todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays === 1
}

/**
 * Update a user's streak after a settled round.
 * - correct: extends the streak if yesterday's call was correct (or starts a
 *   new streak), but only the first correct settlement of a given UTC day
 *   advances the count.
 * - incorrect: breaks the streak.
 * - void: leaves the streak untouched (handled by caller — don't call this
 *   for voided predictions).
 */
export async function updateStreakAfterSettlement(
  userId: number,
  correct: boolean,
  now: Date = new Date()
): Promise<void> {
  const { data: user, error } = await supabase
    .from('users')
    .select('streak_count, streak_last_day')
    .eq('id', userId)
    .single()
  if (error) throw error

  const today = toUtcDateString(now)

  if (!correct) {
    if (user.streak_count !== 0 || user.streak_last_day !== null) {
      await supabase.from('users').update({ streak_count: 0, streak_last_day: null }).eq('id', userId)
    }
    return
  }

  if (user.streak_last_day === today) return // already counted today

  const newCount = user.streak_last_day && isYesterday(user.streak_last_day, today) ? user.streak_count + 1 : 1

  await supabase.from('users').update({ streak_count: newCount, streak_last_day: today }).eq('id', userId)
}
