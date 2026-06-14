import crypto from 'crypto'
import { supabase } from './supabase'
import { createPendingReferral } from './referral'

export interface TelegramWebAppUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

export interface VerifiedInitData {
  user: TelegramWebAppUser
  /** The `ref_<telegramId>` payload, if the Mini App was launched via a referral link. */
  startParam?: string
}

/**
 * Validates Telegram Mini App `initData` per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
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

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
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

/** Ensures a `challengehub_profiles` row exists for the given internal user id. */
async function ensureProfile(userId: number): Promise<void> {
  const { data: existing } = await supabase
    .from('challengehub_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return

  const { error } = await supabase.from('challengehub_profiles').insert({ user_id: userId, xp: 0, level: 1 })
  // Ignore unique-violation races (profile created concurrently).
  if (error && error.code !== '23505') throw error
}

/** Looks up the internal user row for a Telegram user, creating it (and a ChallengeHub profile) if needed. */
export async function getOrCreateUser(tgUser: TelegramWebAppUser, startParam?: string): Promise<{ id: number }> {
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
    await ensureProfile(existing.id)
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

  await ensureProfile(created.id)

  if (startParam?.startsWith('ref_')) {
    const referrerTelegramId = Number(startParam.slice(4))
    if (!Number.isNaN(referrerTelegramId)) {
      await createPendingReferral(created.id, referrerTelegramId)
    }
  }

  return created
}

/**
 * Authenticates a Mini App API request via the `x-telegram-init-data` header.
 * Returns the internal user id, or null if auth fails.
 */
export async function authenticateRequest(initData: string | undefined): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!initData || !botToken) return null

  const verified = verifyInitData(initData, botToken)
  if (!verified) return null

  const user = await getOrCreateUser(verified.user, verified.startParam)
  return user.id
}
