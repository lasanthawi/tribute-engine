import crypto from 'crypto'
import { isDemoMode, supabase } from './supabase'

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

export async function authenticateRequest(initData: string | undefined): Promise<number | null> {
  if (isDemoMode) return 1

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!initData || !botToken) return null

  const verified = verifyInitData(initData, botToken)
  if (!verified) return null

  const user = await getOrCreateUser(verified.user)
  return user.id
}
