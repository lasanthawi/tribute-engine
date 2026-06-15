import { supabase } from './supabase'

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 120)) + 1
}

export async function creditCommunityXp(
  communityId: number,
  userId: number,
  delta: number,
  entryType: string,
  opts: { refUser?: number; refEvent?: number; metadata?: Record<string, unknown> } = {}
) {
  if (delta === 0) return

  const { error } = await supabase.from('community_xp_ledger').insert({
    community_id: communityId,
    user_id: userId,
    delta,
    entry_type: entryType,
    ref_user: opts.refUser ?? null,
    ref_event: opts.refEvent ?? null,
    metadata: opts.metadata ?? {},
  })
  if (error) throw error
}

export async function getCommunityXp(communityId: number, userId: number): Promise<{ xp: number; level: number }> {
  const { data, error } = await supabase
    .from('community_xp_ledger')
    .select('delta')
    .eq('community_id', communityId)
    .eq('user_id', userId)
  if (error) throw error

  const xp = (data ?? []).reduce((sum, row) => sum + row.delta, 0)
  return { xp, level: levelForXp(xp) }
}
