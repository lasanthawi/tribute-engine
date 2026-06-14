import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'
import { createPendingReferral } from '@/lib/referral'
import { broadcastCustomMessage } from '@/lib/notifications'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => !Number.isNaN(id))

function isAdmin(telegramId: number): boolean {
  return ADMIN_TELEGRAM_IDS.includes(telegramId)
}

function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function handleStatsCommand(chatId: number) {
  const now = new Date()
  const todayStart = startOfTodayUtc(now).toISOString()

  const { count: totalUsers } = await supabase.from('users').select('id', { count: 'exact', head: true })
  const { count: dau } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .gte('last_seen_at', todayStart)
  const { count: activeChallenges } = await supabase
    .from('challenges')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  const { count: checkinsToday } = await supabase
    .from('task_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', todayStart)

  await sendTelegramMessage(
    BOT_TOKEN,
    chatId,
    `📊 *ChallengeHub Stats*\n\nTotal users: ${totalUsers ?? 0}\nActive today: ${dau ?? 0}\nActive challenges: ${activeChallenges ?? 0}\nCheck-ins today: ${checkinsToday ?? 0}`,
    'Markdown'
  )
}

async function handleBroadcastCommand(chatId: number, text: string) {
  if (!text) {
    await sendTelegramMessage(BOT_TOKEN, chatId, 'Usage: /broadcast <message>', 'Markdown')
    return
  }

  const { data: users, error } = await supabase.from('users').select('telegram_id')
  if (error) throw error

  const count = await broadcastCustomMessage((users ?? []).map((u) => u.telegram_id), text)
  await sendTelegramMessage(BOT_TOKEN, chatId, `Broadcast sent to ${count} user(s).`, 'Markdown')
}

async function upsertUser(telegramId: number, username?: string): Promise<{ id: number }> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString(), username: username ?? null })
      .eq('id', existing.id)

    const { data: profile } = await supabase
      .from('challengehub_profiles')
      .select('user_id')
      .eq('user_id', existing.id)
      .maybeSingle()
    if (!profile) {
      await supabase.from('challengehub_profiles').insert({ user_id: existing.id, xp: 0, level: 1 })
    }

    return existing
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ telegram_id: telegramId, username: username ?? null, last_seen_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error

  await supabase.from('challengehub_profiles').insert({ user_id: created.id, xp: 0, level: 1 })
  return created
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update.message

    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    if (isAdmin(message.from.id)) {
      if (message.text === '/stats' || message.text.startsWith('/stats ')) {
        await handleStatsCommand(message.chat.id)
        return res.status(200).json({ ok: true })
      }
      if (message.text.startsWith('/broadcast')) {
        await handleBroadcastCommand(message.chat.id, message.text.slice('/broadcast'.length).trim())
        return res.status(200).json({ ok: true })
      }
    }

    if (message.text.startsWith('/start')) {
      const user = await upsertUser(message.from.id, message.from.username)

      const parts = message.text.trim().split(/\s+/)
      const payload = parts[1]
      if (payload?.startsWith('ref_')) {
        const referrerTelegramId = Number(payload.slice(4))
        if (!Number.isNaN(referrerTelegramId)) {
          await createPendingReferral(user.id, referrerTelegramId)
        }
      }

      await sendTelegramMessage(
        BOT_TOKEN,
        message.chat.id,
        '*ChallengeHub* 🏆\n\nJoin community challenges, complete daily tasks, earn XP, and climb the leaderboard.\n\nTap below to get started.',
        'Markdown',
        {
          inline_keyboard: [[{ text: '▶ Open ChallengeHub', web_app: { url: MINI_APP_URL } }]],
        }
      )
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram/webhook error:', error)
    res.status(200).json({ ok: true }) // always 200 so Telegram doesn't retry-storm
  }
}
