import { NextApiRequest, NextApiResponse } from 'next'
import { broadcastCustomMessage } from '../../../lib/notifications'
import { supabase } from '../../../lib/supabase'
import { sendTelegramMessage, TelegramUpdate } from '../../../lib/telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map((id) => Number(id.trim()))
  .filter((id) => !Number.isNaN(id))

function isAdmin(telegramId: number): boolean {
  return ADMIN_TELEGRAM_IDS.includes(telegramId)
}

function formatEventAt(isoString: string): string {
  return new Date(isoString).toUTCString().replace(' GMT', ' UTC')
}

async function handleStatsCommand(chatId: number) {
  const now = new Date()
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()

  const [{ count: totalMembers }, { count: activeToday }, { count: upcomingEvents }] =
    await Promise.all([
      supabase.from('community_profiles').select('user_id', { count: 'exact', head: true }),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('last_seen_at', todayStart),
      supabase
        .from('community_events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'upcoming'),
    ])

  await sendTelegramMessage(
    BOT_TOKEN,
    chatId,
    `📊 *Community OS Stats*\n\nTotal members: ${totalMembers ?? 0}\nActive today: ${activeToday ?? 0}\nUpcoming events: ${upcomingEvents ?? 0}`,
    'Markdown'
  )
}

async function handleBroadcastCommand(chatId: number, text: string) {
  if (!text) {
    await sendTelegramMessage(BOT_TOKEN, chatId, 'Usage: /broadcast <message>', 'Markdown')
    return
  }

  const { data: users, error } = await supabase
    .from('community_profiles')
    .select('users(telegram_id)')
  if (error) throw error

  const telegramIds = (users ?? [])
    .map((row: any) => row.users?.telegram_id)
    .filter(Boolean) as number[]

  const count = await broadcastCustomMessage(telegramIds, text)
  await sendTelegramMessage(BOT_TOKEN, chatId, `Broadcast sent to ${count} member(s).`, 'Markdown')
}

async function handleEventsCommand(chatId: number) {
  const { data: events, error } = await supabase
    .from('community_events')
    .select('title, description, event_at')
    .eq('status', 'upcoming')
    .order('event_at', { ascending: true })
    .limit(5)

  if (error) throw error

  if (!events || events.length === 0) {
    await sendTelegramMessage(BOT_TOKEN, chatId, 'No upcoming events. Stay tuned!', 'Markdown')
    return
  }

  const lines = events.map(
    (e) => `📅 *${e.title}*\n${e.description ? `${e.description}\n` : ''}🕐 ${formatEventAt(e.event_at)}`
  )
  await sendTelegramMessage(
    BOT_TOKEN,
    chatId,
    `*Upcoming Events*\n\n${lines.join('\n\n')}`,
    'Markdown'
  )
}

async function upsertMember(telegramId: number, username?: string): Promise<{ id: number }> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  let userId: number

  if (existing) {
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString(), username: username ?? null })
      .eq('id', existing.id)
    userId = existing.id
  } else {
    const { data: created, error } = await supabase
      .from('users')
      .insert({ telegram_id: telegramId, username: username ?? null, last_seen_at: new Date().toISOString() })
      .select('id')
      .single()
    if (error) throw error
    userId = created.id
  }

  const { data: profile } = await supabase
    .from('community_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    await supabase.from('community_profiles').insert({ user_id: userId })
  }

  return { id: userId }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update.message

    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    const { text, chat, from } = message

    if (isAdmin(from.id)) {
      if (text === '/stats' || text.startsWith('/stats ')) {
        await handleStatsCommand(chat.id)
        return res.status(200).json({ ok: true })
      }
      if (text.startsWith('/broadcast')) {
        await handleBroadcastCommand(chat.id, text.slice('/broadcast'.length).trim())
        return res.status(200).json({ ok: true })
      }
    }

    if (text === '/events' || text.startsWith('/events ')) {
      await handleEventsCommand(chat.id)
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/start')) {
      await upsertMember(from.id, from.username)

      await sendTelegramMessage(
        BOT_TOKEN,
        chat.id,
        `*Community OS* 🌐\n\nWelcome to the community!\n\nYou're now registered as a member.\n\n/events — see upcoming events\n/help — show commands`,
        'Markdown'
      )
      return res.status(200).json({ ok: true })
    }

    if (text === '/help') {
      await sendTelegramMessage(
        BOT_TOKEN,
        chat.id,
        `*Community OS Commands*\n\n/start — join the community\n/events — upcoming events\n/help — this message`,
        'Markdown'
      )
      return res.status(200).json({ ok: true })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram/webhook error:', error)
    res.status(200).json({ ok: true }) // always 200 so Telegram doesn't retry-storm
  }
}
