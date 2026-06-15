import { AccessLogRow, supabase } from './supabase'

export async function logAccessEvent(
  communityId: number,
  action: 'grant' | 'revoke' | 'sync' | 'invite_link',
  status: 'pending' | 'success' | 'failed',
  opts: { userId?: number | null; message?: string | null } = {}
) {
  const { data, error } = await supabase
    .from('telegram_access_logs')
    .insert({
      community_id: communityId,
      user_id: opts.userId ?? null,
      action,
      status,
      message: opts.message ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AccessLogRow
}

export async function syncPendingAccess() {
  const { data: pending, error } = await supabase
    .from('community_members')
    .select('community_id, user_id')
    .eq('access_status', 'pending')
    .limit(100)
  if (error) throw error

  let synced = 0
  for (const member of pending ?? []) {
    const { data: community } = await supabase
      .from('communities')
      .select('telegram_chat_id')
      .eq('id', member.community_id)
      .maybeSingle()

    if (!community?.telegram_chat_id) {
      await logAccessEvent(member.community_id, 'sync', 'failed', {
        userId: member.user_id,
        message: 'Missing telegram_chat_id. Manual invite required.',
      })
      continue
    }

    await supabase
      .from('community_members')
      .update({ access_status: 'granted', last_active_at: new Date().toISOString() })
      .eq('community_id', member.community_id)
      .eq('user_id', member.user_id)

    await logAccessEvent(member.community_id, 'grant', 'success', {
      userId: member.user_id,
      message: 'Access marked granted by beta sync.',
    })
    synced++
  }

  return { scanned: pending?.length ?? 0, synced }
}

export async function listAccessLogs(communityId: number): Promise<AccessLogRow[]> {
  const { data, error } = await supabase
    .from('telegram_access_logs')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as AccessLogRow[]
}
