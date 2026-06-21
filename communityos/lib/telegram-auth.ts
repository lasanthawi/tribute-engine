import crypto from 'crypto'
import { ASSET_BUCKET, ensureAssetBucket } from './assets'
import { sb, supabase } from './supabase'
import { getChat, getFile } from './telegram'

export interface TelegramWebAppUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

export interface VerifiedInitData {
  user: TelegramWebAppUser
  startParam?: string
}

export function verifyInitData(initData: string, botToken: string): VerifiedInitData | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null
    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken.trim()).digest()
    const computedHash = crypto.createHmac('sha256', Uint8Array.from(secretKey)).update(dataCheckString).digest('hex')
    if (computedHash !== hash) return null

    const userJson = params.get('user')
    if (!userJson) return null
    return { user: JSON.parse(userJson) as TelegramWebAppUser, startParam: params.get('start_param') ?? undefined }
  } catch (error) {
    console.error('initData verification failed:', error)
    return null
  }
}

export async function getOrCreateUser(tgUser: TelegramWebAppUser): Promise<{ id: number }> {
  const { data: existing } = await supabase.from('users').select('id').eq('telegram_id', tgUser.id).maybeSingle()
  if (existing) {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString(), username: tgUser.username ?? null })
      .eq('id', existing.id)
    return existing
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ telegram_id: tgUser.id, username: tgUser.username ?? null, last_seen_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return created
}

// Pulls a Telegram user's own profile photo via the Bot API and stores it in
// Supabase Storage, mirroring syncCommunityAvatar. initData's optional
// `photo_url` field is unreliable (Telegram only includes it for some launch
// contexts), so this fetches it directly via getChat instead. Best-effort:
// requires the bot to have an existing chat with the user (true once they've
// pressed /start), and never blocks login on failure.
export async function syncUserAvatar(userId: number, telegramId: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  if (!botToken) return

  const chat = await getChat(botToken, telegramId)
  if (!chat?.photoBigFileId) return

  const filePath = await getFile(botToken, chat.photoBigFileId)
  if (!filePath) return

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`)
  if (!fileRes.ok) return
  const buffer = Buffer.from(await fileRes.arrayBuffer())

  const path = `user/${userId}/avatar/${Date.now()}.jpg`
  await ensureAssetBucket()
  const { error: uploadError } = await sb.storage.from(ASSET_BUCKET).upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { error } = await supabase.from('users').update({ avatar_path: path }).eq('id', userId)
  if (error) throw error
}

// Retries the sync on read whenever it hasn't succeeded yet, same pattern as
// ensureCommunityAvatar — covers a profile photo set/changed after first
// login and a sync that previously failed.
export async function ensureUserAvatar(user: { id: number; avatar_path: string | null; telegram_id: number }): Promise<string | null> {
  if (user.avatar_path) return user.avatar_path
  await syncUserAvatar(user.id, user.telegram_id).catch((error) => console.error('ensureUserAvatar failed:', error))
  const { data: refreshed } = await supabase.from('users').select('avatar_path').eq('id', user.id).maybeSingle()
  return refreshed?.avatar_path ?? null
}

export async function authenticateRequest(initData: string | undefined): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!initData || !botToken) return null

  const verified = verifyInitData(initData, botToken)
  if (!verified) return null

  const user = await getOrCreateUser(verified.user)
  return user.id
}
