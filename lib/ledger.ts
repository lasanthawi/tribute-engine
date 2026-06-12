import { supabase, LedgerEntryType, TicketReason } from './supabase'

export async function getUserBalance(userId: number): Promise<{ points: number; tickets: number }> {
  const { data, error } = await supabase
    .from('user_balances')
    .select('points, tickets')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return { points: data?.points ?? 0, tickets: data?.tickets ?? 0 }
}

export async function creditPoints(
  userId: number,
  delta: number,
  entryType: LedgerEntryType,
  opts: { refRound?: number; refUser?: number } = {}
) {
  if (delta === 0) return
  const { error } = await supabase.from('points_ledger').insert({
    user_id: userId,
    delta,
    entry_type: entryType,
    ref_round: opts.refRound ?? null,
    ref_user: opts.refUser ?? null,
  })
  if (error) throw error
}

export async function adjustTickets(userId: number, delta: number, reason: TicketReason) {
  if (delta === 0) return
  const { error } = await supabase.from('ticket_ledger').insert({
    user_id: userId,
    delta,
    reason,
  })
  if (error) throw error
}

export async function hasTickets(userId: number, amount = 1): Promise<boolean> {
  const { tickets } = await getUserBalance(userId)
  return tickets >= amount
}

const DAILY_LOGIN_BONUS = 50
export const FREE_TICKETS_PER_DAY = 5

/**
 * Grants the one-time-per-UTC-day login bonus. Returns true if granted just
 * now, false if the user already claimed today's bonus.
 */
export async function claimDailyLoginBonus(userId: number, now: Date = new Date()): Promise<boolean> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const { data: existing, error } = await supabase
    .from('points_ledger')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_type', 'daily_login')
    .gte('created_at', startOfDay.toISOString())
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (existing) return false

  await creditPoints(userId, DAILY_LOGIN_BONUS, 'daily_login')
  return true
}

export { DAILY_LOGIN_BONUS }
