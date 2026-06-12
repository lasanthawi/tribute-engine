import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

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
    return existing
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ telegram_id: telegramId, username: username ?? null, last_seen_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw error
  return created
}

async function maybeCreateReferral(refereeId: number, referrerTelegramId: number) {
  const { data: referrer } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', referrerTelegramId)
    .maybeSingle()
  if (!referrer || referrer.id === refereeId) return

  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', refereeId)
    .maybeSingle()
  if (existing) return

  await supabase.from('referrals').insert({ referrer_id: referrer.id, referee_id: refereeId, status: 'pending' })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update.message
    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    if (message.text.startsWith('/start')) {
      const user = await upsertUser(message.from.id, message.from.username)

      const parts = message.text.trim().split(/\s+/)
      const payload = parts[1]
      if (payload?.startsWith('ref_')) {
        const referrerTelegramId = Number(payload.slice(4))
        if (!Number.isNaN(referrerTelegramId)) {
          await maybeCreateReferral(user.id, referrerTelegramId)
        }
      }

      await sendTelegramMessage(
        BOT_TOKEN,
        message.chat.id,
        '*VOTE LEAGUE* 🗳️\n\nDaily UP/DOWN crypto votes. Free tickets, streaks, and a referral chain that pays you forever. Cast your vote, climb the league.\n\nTap below to play.',
        'Markdown',
        {
          inline_keyboard: [[{ text: '▶ Open VOTE LEAGUE', web_app: { url: MINI_APP_URL } }]],
        }
      )
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram/webhook error:', error)
    res.status(200).json({ ok: true }) // always 200 so Telegram doesn't retry-storm
  }
}
