import { AccessLogRow, sb, supabase } from './supabase'
import type { JoinRequestDto, TelegramChatDto } from './api-client'
import { approveChatJoinRequest, banChatMember, createChatInviteLink, declineChatJoinRequest, unbanChatMember } from './telegram'
import { createCommunity } from './communities'

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

// When the bot is added as admin to a group, find or create a community to link it to.
// If the user has exactly one unlinked community, use that. If none, create one.
export async function autoLinkChatToCommunity(
  telegramUserId: number,
  telegramChatId: string,
  chatTitle?: string
): Promise<number | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramUserId)
    .maybeSingle()
  if (!user) return null

  const { data: unlinked } = await supabase
    .from('communities')
    .select('id')
    .eq('owner_id', user.id)
    .is('telegram_chat_id', null)

  if (!unlinked || unlinked.length === 0) {
    // No existing community — auto-create a fully initialised one (includes community_members owner row)
    const community = await createCommunity(user.id, {
      name: chatTitle || 'My Community',
      telegramChatId: Number(telegramChatId),
    })
    return community.id
  }

  if (unlinked.length > 1) {
    // Multiple unlinked communities — can't auto-pick, admin must connect manually
    return null
  }

  // Exactly one unlinked community — link it
  const communityId = unlinked[0].id
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

export async function listJoinRequests(communityId: number): Promise<JoinRequestDto[]> {
  const { data, error } = await sb
    .from('telegram_join_requests')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    telegramUserId: row.telegram_user_id,
    username: row.username,
    status: row.status,
    referralCode: row.referral_code,
    createdAt: row.created_at,
  }))
}

async function getTelegramUserId(userId: number): Promise<number | null> {
  const { data } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle()
  return data?.telegram_id ?? null
}

async function connectedChatIds(communityId: number): Promise<Array<number | string>> {
  const { data: chats } = await sb.from('telegram_chats').select('telegram_chat_id').eq('community_id', communityId).eq('bot_status', 'admin')
  const ids = (chats ?? []).map((chat: any) => chat.telegram_chat_id).filter(Boolean)
  if (ids.length) return ids
  const { data: community } = await supabase.from('communities').select('telegram_chat_id').eq('id', communityId).maybeSingle()
  return community?.telegram_chat_id ? [community.telegram_chat_id] : []
}

async function removeMemberFromConnectedChats(communityId: number, userId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const telegramUserId = await getTelegramUserId(userId)
  if (!botToken || !telegramUserId) return { attempted: 0, failed: 0 }

  let attempted = 0
  let failed = 0
  for (const chatId of await connectedChatIds(communityId)) {
    attempted++
    try {
      await banChatMember(botToken, chatId, telegramUserId)
      await unbanChatMember(botToken, chatId, telegramUserId)
    } catch (error) {
      failed++
      console.error('removeMemberFromConnectedChats failed:', error)
    }
  }
  return { attempted, failed }
}

export async function recordJoinRequest(opts: {
  communityId: number
  telegramChatId: string
  telegramUserId: string
  username?: string | null
  referralCode?: string | null
}) {
  const { data: chat } = await sb
    .from('telegram_chats')
    .select('id')
    .eq('community_id', opts.communityId)
    .eq('telegram_chat_id', opts.telegramChatId)
    .maybeSingle()

  const { data: existing } = await sb
    .from('telegram_join_requests')
    .select('*')
    .eq('community_id', opts.communityId)
    .eq('telegram_user_id', opts.telegramUserId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await sb
    .from('telegram_join_requests')
    .insert({
      community_id: opts.communityId,
      telegram_chat_id: chat?.id ?? null,
      telegram_user_id: opts.telegramUserId,
      username: opts.username ?? null,
      referral_code: opts.referralCode ?? null,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
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

  let inviteLink: string | null = null
  const [chatId] = await connectedChatIds(communityId)
  if (botToken && chatId) {
    try {
      inviteLink = await createChatInviteLink(botToken, chatId, { memberLimit: 1 })
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

  const removal = await removeMemberFromConnectedChats(communityId, userId)
  const status = removal.failed > 0 ? 'failed' : 'success'
  const message =
    removal.attempted > 0
      ? removal.failed > 0
        ? `Access revoked in database. Telegram removal failed in ${removal.failed}/${removal.attempted} chats.`
        : `Access revoked and member removed from ${removal.attempted} Telegram chat${removal.attempted === 1 ? '' : 's'}.`
      : 'Access revoked.'

  await logAccessEvent(communityId, 'revoke', status, { userId, message })
  return { ok: true as const }
}

export async function suspendMemberAccess(communityId: number, userId: number) {
  await supabase
    .from('community_members')
    .update({ access_status: 'suspended' as any })
    .eq('community_id', communityId)
    .eq('user_id', userId)

  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const telegramUserId = await getTelegramUserId(userId)
  if (botToken && telegramUserId) {
    for (const chatId of await connectedChatIds(communityId)) {
      await banChatMember(botToken, chatId, telegramUserId).catch((error) => {
        console.error('banChatMember failed:', error)
      })
    }
  }

  await logAccessEvent(communityId, 'revoke', 'success', { userId, message: 'Access suspended.' })
  return { ok: true as const }
}

export async function restoreMemberAccess(communityId: number, userId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const telegramUserId = await getTelegramUserId(userId)
  if (botToken && telegramUserId) {
    for (const chatId of await connectedChatIds(communityId)) {
      await unbanChatMember(botToken, chatId, telegramUserId).catch((error) => {
        console.error('unbanChatMember failed:', error)
      })
    }
  }
  return grantMemberAccess(communityId, userId)
}

export async function approveJoinRequest(communityId: number, joinRequestId: number, decidedBy?: number | null) {
  const { data: request, error } = await sb
    .from('telegram_join_requests')
    .select('*, telegram_chats(telegram_chat_id)')
    .eq('community_id', communityId)
    .eq('id', joinRequestId)
    .maybeSingle()
  if (error) throw error
  if (!request) return { ok: false as const, reason: 'Join request not found' }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const chatId = request.telegram_chats?.telegram_chat_id
  if (botToken && chatId) await approveChatJoinRequest(botToken, chatId, request.telegram_user_id)

  await sb
    .from('telegram_join_requests')
    .update({ status: 'approved', decided_at: new Date().toISOString(), decided_by: decidedBy ?? null })
    .eq('id', joinRequestId)

  // Sync DB access status so the member dashboard reflects the approval
  const { data: approvedUser } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', Number(request.telegram_user_id))
    .maybeSingle()
  if (approvedUser?.id) {
    await grantMemberAccess(communityId, approvedUser.id)
  } else {
    await logAccessEvent(communityId, 'grant', 'success', { message: `Join request approved for @${request.username ?? request.telegram_user_id}` })
  }

  return { ok: true as const }
}

export async function declineJoinRequest(communityId: number, joinRequestId: number, decidedBy?: number | null) {
  const { data: request, error } = await sb
    .from('telegram_join_requests')
    .select('*, telegram_chats(telegram_chat_id)')
    .eq('community_id', communityId)
    .eq('id', joinRequestId)
    .maybeSingle()
  if (error) throw error
  if (!request) return { ok: false as const, reason: 'Join request not found' }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const chatId = request.telegram_chats?.telegram_chat_id
  if (botToken && chatId) await declineChatJoinRequest(botToken, chatId, request.telegram_user_id)

  await sb
    .from('telegram_join_requests')
    .update({ status: 'declined', decided_at: new Date().toISOString(), decided_by: decidedBy ?? null })
    .eq('id', joinRequestId)

  await logAccessEvent(communityId, 'revoke', 'success', { message: `Join request declined for @${request.username ?? request.telegram_user_id}` })
  return { ok: true as const }
}
