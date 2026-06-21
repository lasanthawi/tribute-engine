import { sb, supabase } from './supabase'
import { getCommunity } from './communities'
import { getChat, sendTelegramMessage, sendTelegramPhoto } from './telegram'

export interface ConnectedChatInfo {
  title: string
  activeMembers: number
  photoFileId: string | null
}

// Looks up the community's connected (bot-admin) Telegram chat and, best-effort,
// its current profile photo file_id straight from the Bot API — used to enrich
// share captions with the real channel/group identity, not just the community name.
export async function getConnectedChatInfo(communityId: number, telegramChatId: number | null): Promise<ConnectedChatInfo | null> {
  if (!telegramChatId) return null
  const { data } = await sb
    .from('telegram_chats')
    .select('title, active_members, bot_status')
    .eq('community_id', communityId)
    .eq('telegram_chat_id', String(telegramChatId))
    .eq('bot_status', 'admin')
    .maybeSingle()
  if (!data) return null

  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  let photoFileId: string | null = null
  if (botToken) {
    try {
      const chat = await getChat(botToken, telegramChatId)
      photoFileId = chat?.photoBigFileId ?? null
    } catch (error) {
      console.error('getConnectedChatInfo: getChat failed', error)
    }
  }

  return { title: data.title, activeMembers: data.active_members ?? 0, photoFileId }
}

export interface ShareTarget {
  chatId: number | string | null
  target: 'community_chat' | 'owner_chat'
}

// Decides where a share message should actually go: the connected community
// chat when the bot is admin there, falling back to the owner's own DM with
// the bot otherwise (instead of accidentally trying — and failing — a send
// to a chat the bot no longer has rights in).
export async function resolveShareTarget(communityId: number, ownerUserId: number): Promise<ShareTarget> {
  const community = await getCommunity(communityId)
  if (community?.telegram_chat_id) {
    const { data } = await sb
      .from('telegram_chats')
      .select('bot_status')
      .eq('community_id', communityId)
      .eq('telegram_chat_id', String(community.telegram_chat_id))
      .maybeSingle()
    if (data?.bot_status === 'admin') {
      return { chatId: community.telegram_chat_id, target: 'community_chat' }
    }
  }
  const { data: owner } = await supabase.from('users').select('telegram_id').eq('id', ownerUserId).maybeSingle()
  return { chatId: owner?.telegram_id ?? null, target: 'owner_chat' }
}

export async function sendShareMessage(opts: {
  botToken: string
  chatId: number | string
  caption: string
  buttonText: string
  deepLink: string
  photoFileId?: string | null
}) {
  const replyMarkup = { inline_keyboard: [[{ text: opts.buttonText, url: opts.deepLink }]] }
  if (opts.photoFileId) {
    await sendTelegramPhoto(opts.botToken, opts.chatId, opts.photoFileId, opts.caption, 'HTML', replyMarkup)
  } else {
    await sendTelegramMessage(opts.botToken, opts.chatId, opts.caption, 'HTML', replyMarkup)
  }
}
