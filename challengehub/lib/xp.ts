import { supabase, XpEntryType } from './supabase'

/** Simple level curve: level N requires N^2 * 100 cumulative XP. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1
}

/**
 * Appends an entry to the append-only `xp_ledger` (source of truth) and
 * updates the denormalized cache on `challengehub_profiles`.
 */
export async function creditXp(
  userId: number,
  delta: number,
  entryType: XpEntryType,
  opts: { refChallenge?: number; refUser?: number } = {}
) {
  if (delta === 0) return

  const { error } = await supabase.from('xp_ledger').insert({
    user_id: userId,
    delta,
    entry_type: entryType,
    ref_challenge: opts.refChallenge ?? null,
    ref_user: opts.refUser ?? null,
  })
  if (error) throw error

  await refreshProfileXp(userId)
}

/** Recomputes and persists the denormalized xp/level on challengehub_profiles from xp_ledger. */
export async function refreshProfileXp(userId: number): Promise<{ xp: number; level: number }> {
  const { data: entries, error } = await supabase.from('xp_ledger').select('delta').eq('user_id', userId)
  if (error) throw error

  const xp = (entries ?? []).reduce((sum, e) => sum + e.delta, 0)
  const level = levelForXp(xp)

  const { error: upsertErr } = await supabase
    .from('challengehub_profiles')
    .upsert({ user_id: userId, xp, level }, { onConflict: 'user_id' })
  if (upsertErr) throw upsertErr

  return { xp, level }
}

/**
 * Returns the user's current daily check-in streak (consecutive days with at
 * least one daily_task/catchup_task entry), and whether today's check-in is
 * still outstanding (streak would break if they don't check in today).
 */
export async function getStreak(userId: number): Promise<{ streak: number; atRisk: boolean }> {
  const { data, error } = await supabase
    .from('xp_ledger')
    .select('created_at')
    .eq('user_id', userId)
    .in('entry_type', ['daily_task', 'catchup_task'])
  if (error) throw error

  const dates = new Set((data ?? []).map((e) => e.created_at.slice(0, 10)))
  const oneDay = 24 * 60 * 60 * 1000

  let cursor = new Date()
  const todayStr = cursor.toISOString().slice(0, 10)
  let atRisk = false
  if (!dates.has(todayStr)) {
    atRisk = true
    cursor = new Date(cursor.getTime() - oneDay)
  }

  let streak = 0
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor = new Date(cursor.getTime() - oneDay)
  }

  if (streak === 0) atRisk = false
  return { streak, atRisk }
}

/** Returns the user's current XP total and level, ensuring a profile row exists. */
export async function getUserXp(userId: number): Promise<{ xp: number; level: number }> {
  const { data, error } = await supabase
    .from('challengehub_profiles')
    .select('xp, level')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  if (data) return { xp: data.xp, level: data.level }

  // No profile row yet — create it and compute from ledger (likely 0).
  return refreshProfileXp(userId)
}
