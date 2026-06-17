import { AccessLogRow, sb, supabase } from './supabase'
import type { TelegramChatDto } from './api-client'
import { createChatInviteLink } from './telegram'

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

export async function syncPendingAccess(communityId?: number) {
  let query = supabase
    .from('community_members')
    .select('community_id, user_id')
    .eq('access_status', 'pending')
    .limit(50)

  if (communityId) query = query.eq('community_id', communityId)

  const { data: pending, error } = await query
  if (error) throw error

  let synced = 0
  for (const member of pending ?? []) {
    try {
      await grantMemberAccess(member.community_id, member.user_id)
      synced++
    } catch (err) {
      console.error('syncPendingAccess: grant failed for member', member, err)
      await logAccessEvent(member.community_id, 'sync', 'failed', {
        userId: member.user_id,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return { scanned: pending?.length ?? 0, synced }
}

// ---------------------------------------------------------------------------
// Telegram chat registration helpers
// ---------------------------------------------------------------------------

export async function upsertTelegramChat(opts: {
  communityId: number
  telegramChatId: string
  title: string
  handle?: string | null
  chatType: 'group' | 'supergroup' | 'channel'
  botStatus: 'admin' | 'not_connected'
}) {
  const { error } = await sb.from('telegram_chats').upsert(
    {
      community_id: opts.communityId,
      telegram_chat_id: opts.telegramChatId,
      title: opts.title,
      handle: opts.handle ?? null,
      chat_type: opts.chatType === 'channel' ? 'channel' : 'group',
      bot_status: opts.botStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'community_id,telegram_chat_id' }
  )
  if (error) throw error
}

export async function findCommunityForChat(telegramChatId: string): Promise<number | null> {
  // Check the legacy direct-link column first
  const { data: community } = await supabase
    .from('communities')
    .select('id')
    .eq('telegram_chat_id', Number(telegramChatId))
    .maybeSingle()
  if (community) return community.id

  // Then check the multi-chat table
  const { data: chat } = await sb
    .from('telegram_chats')
    .select('community_id')
    .eq('telegram_chat_id', telegramChatId)
    .maybeSingle()
  return chat?.community_id ?? null
}

// When the bot is added as admin to a group and no community is linked yet,
// try to auto-link it to the single community owned by the user who added it.
export async function autoLinkChatToCommunity(
  telegramUserId: number,
  telegramChatId: string
): Promise<number | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUserId)
    .maybeSingle()
  if (!user) return null

  const { data: communities } = await supabase
    .from('communities')
    .select('id')
    .eq('owner_id', user.id)
    .is('telegram_chat_id', null)
  if (!communities || communities.length !== 1) return null

  const communityId = communities[0].id
  await supabase
    .from('communities')
    .update({ telegram_chat_id: Number(telegramChatId) })
    .eq('id', communityId)

  return communityId
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

export async function listChats(communityId: number): Promise<TelegramChatDto[]> {
  const { data, error } = await sb
    .from('telegram_chats')
    .select('*')
    .eq('community_id', communityId)
    .order('id', { ascending: true })
  if (error) throw error
  return ((data ?? []) as any[]).map((chat) => ({
    id: chat.id,
    title: chat.title,
    handle: chat.handle,
    type: (chat.chat_type === 'channel' ? 'channel' : 'group') as TelegramChatDto['type'],
    botStatus: chat.bot_status as TelegramChatDto['botStatus'],
    accessMode: (chat.access_mode === 'invite_link' ? 'invite_link' : 'join_request') as TelegramChatDto['accessMode'],
    activeMembers: chat.active_members ?? 0,
  }))
}

// Grants a member access: marks them granted, records a grant row, and — when a
// chat + bot token are available — issues a single-use Telegram invite link.
export async function grantMemberAccess(communityId: number, userId: number) {
  await supabase
    .from('community_members')
    .update({ access_status: 'granted', last_active_at: new Date().toISOString() })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const { data: community } = await supabase
    .from('communities')
    .select('telegram_chat_id')
    .eq('id', communityId)
    .maybeSingle()

  let inviteLink: string | null = null
  if (botToken && community?.telegram_chat_id) {
    try {
      inviteLink = await createChatInviteLink(botToken, community.telegram_chat_id, { memberLimit: 1 })
    } catch (error) {
      console.error('createChatInviteLink failed:', error)
    }
  }

  await logAccessEvent(communityId, inviteLink ? 'invite_link' : 'grant', 'success', {
    userId,
    message: inviteLink ? `Invite link issued: ${inviteLink}` : 'Access granted.',
  })

  return { ok: true as const, inviteLink }
}

export async function revokeMemberAccess(communityId: number, userId: number) {
  await supabase
    .from('community_members')
    .update({ access_status: 'revoked' })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  await logAccessEvent(communityId, 'revoke', 'success', { userId, message: 'Access revoked.' })
  return { ok: true as const }
}
