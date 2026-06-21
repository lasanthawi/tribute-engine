import { AccessLogRow, sb, supabase } from './supabase'
import type { CommentAccessDto, JoinRequestDto, TelegramChatDto } from './api-client'
import { ASSET_BUCKET, ensureAssetBucket } from './assets'
import { approveChatJoinRequest, banChatMember, createChatInviteLink, declineChatJoinRequest, getChat, getFile, setChatPermissions, unbanChatMember } from './telegram'
import { createCommunity, getCommunity } from './communities'
import { activateCommunityReferral } from './referrals'
import { sendWelcomeMessage } from './notifications'
import { evaluateRewardRules } from './reward-rules'

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

// Pulls the chat's current profile photo straight from the Bot API and stores
// it in Supabase Storage, so the Mini App can show the real channel/group
// image instead of a generic placeholder. Best-effort: a missing photo or a
// failed download/upload should never block the chat-connection flow.
export async function syncCommunityAvatar(communityId: number, telegramChatId: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!botToken) return

  const chat = await getChat(botToken, telegramChatId)
  if (!chat?.photoBigFileId) return

  const filePath = await getFile(botToken, chat.photoBigFileId)
  if (!filePath) return

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`)
  if (!fileRes.ok) return
  const buffer = Buffer.from(await fileRes.arrayBuffer())

  const path = `${communityId}/avatar/${Date.now()}.jpg`
  await ensureAssetBucket()
  const { error: uploadError } = await sb.storage.from(ASSET_BUCKET).upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { error } = await supabase.from('communities').update({ avatar_path: path } as any).eq('id', communityId)
  if (error) throw error
}

// Telegram only exposes a linked discussion group on the channel's own getChat
// response (`linked_chat_id`). Call this whenever a channel is (re)confirmed
// as admin-connected so Comment Access knows which group to moderate.
export async function syncDiscussionChat(communityId: number, telegramChatId: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!botToken) return
  const chat = await getChat(botToken, telegramChatId)
  if (!chat?.linkedChatId) return
  const { error } = await sb
    .from('telegram_chats')
    .update({ discussion_chat_id: chat.linkedChatId })
    .eq('community_id', communityId)
    .eq('telegram_chat_id', telegramChatId)
  if (error) throw error
}

// The bot's own membership in a discussion group arrives as a separate
// my_chat_member event for that group's chat id — match it back to whichever
// channel row already recorded it as discussion_chat_id.
export async function syncDiscussionBotStatus(
  telegramChatId: string,
  status: 'admin' | 'missing_permissions' | 'not_connected'
): Promise<void> {
  const { error } = await sb.from('telegram_chats').update({ discussion_bot_status: status }).eq('discussion_chat_id', Number(telegramChatId))
  if (error) throw error
}

export async function getCommentAccessStatus(communityId: number): Promise<CommentAccessDto> {
  const { data: chat } = await sb
    .from('telegram_chats')
    .select('discussion_chat_id, discussion_bot_status')
    .eq('community_id', communityId)
    .eq('bot_status', 'admin')
    .not('discussion_chat_id', 'is', null)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  const community = await getCommunity(communityId)
  return {
    linked: !!chat?.discussion_chat_id,
    discussionBotStatus: chat?.discussion_bot_status ?? null,
    enabled: (community?.settings as any)?.commentAccessEnabled !== false,
  }
}

// Comment Access is inherently channel-wide: Telegram exposes one permission
// set per discussion group, not per post, so this can never be scoped to a
// single plan/product/event.
export async function setCommentAccess(communityId: number, enabled: boolean): Promise<{ ok: true } | { ok: false; reason: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!botToken) return { ok: false, reason: 'Bot is not configured.' }

  const { data: chat } = await sb
    .from('telegram_chats')
    .select('discussion_chat_id, discussion_bot_status')
    .eq('community_id', communityId)
    .eq('bot_status', 'admin')
    .not('discussion_chat_id', 'is', null)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!chat?.discussion_chat_id) return { ok: false, reason: 'Link a discussion group to your channel first.' }
  if (chat.discussion_bot_status !== 'admin') return { ok: false, reason: 'Promote the bot to admin in your discussion group first.' }

  await setChatPermissions(botToken, chat.discussion_chat_id, {
    can_send_messages: enabled,
    can_send_other_messages: enabled,
  })

  const community = await getCommunity(communityId)
  const { error } = await supabase
    .from('communities')
    .update({ settings: { ...(community?.settings ?? {}), commentAccessEnabled: enabled } } as any)
    .eq('id', communityId)
  if (error) throw error

  return { ok: true }
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
  const { data: before } = await supabase
    .from('community_members')
    .select('access_status')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .maybeSingle()
  const isFirstGrant = before?.access_status !== 'granted'

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

  // Referral activation and the welcome message should only fire once, on the
  // member's actual first grant — not on renewals or a restore-after-suspend.
  if (isFirstGrant) {
    const { data: pendingReferral } = await supabase
      .from('community_referrals')
      .select('id, referrer_id')
      .eq('community_id', communityId)
      .eq('referee_id', userId)
      .eq('status', 'joined')
      .maybeSingle()
    if (pendingReferral) {
      await activateCommunityReferral(communityId, pendingReferral.referrer_id, userId).catch((error) =>
        console.error('activateCommunityReferral failed:', error)
      )
    }

    const [telegramId, community] = await Promise.all([getTelegramUserId(userId), getCommunity(communityId)])
    if (telegramId && community) {
      await sendWelcomeMessage(telegramId, community.name)
    }

    await evaluateRewardRules(communityId, userId, 'member_joined').catch((error) =>
      console.error('evaluateRewardRules(member_joined) failed:', error)
    )
  }

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
