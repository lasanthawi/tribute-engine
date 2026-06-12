import crypto from 'crypto'
import { supabase } from './supabase'
import { adjustTickets, FREE_TICKETS_PER_DAY } from './ledger'

export interface TelegramWebAppUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

/**
 * Validates Telegram Mini App `initData` per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string): TelegramWebAppUser | null {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null
    params.delete('hash')

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    if (computedHash !== hash) return null

    const userJson = params.get('user')
    if (!userJson) return null
    return JSON.parse(userJson) as TelegramWebAppUser
  } catch (error) {
    console.error('initData verification failed:', error)
    return null
  }
}

/** Looks up the internal user row for a Telegram user, creating it if needed. */
export async function getOrCreateUser(tgUser: TelegramWebAppUser): Promise<{ id: number }> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString(), username: tgUser.username ?? null })
      .eq('id', existing.id)
    return existing
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error

  await adjustTickets(created.id, FREE_TICKETS_PER_DAY, 'daily_grant')
  return created
}

/**
 * Authenticates a Mini App API request via the `x-telegram-init-data` header.
 * Returns the internal user id, or null if auth fails.
 */
export async function authenticateRequest(initData: string | undefined): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!initData || !botToken) return null

  const tgUser = verifyInitData(initData, botToken)
  if (!tgUser) return null

  const user = await getOrCreateUser(tgUser)
  return user.id
}
