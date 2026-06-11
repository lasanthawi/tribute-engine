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
