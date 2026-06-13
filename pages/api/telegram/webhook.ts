import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage, answerPreCheckoutQuery, TelegramUpdate } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'
import { adjustTickets, creditCoins, FREE_TICKETS_PER_DAY } from '@/lib/ledger'
import { createPendingReferral } from '@/lib/referral'
import { COIN_PACKAGES } from '@/lib/coins'

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

  await adjustTickets(created.id, FREE_TICKETS_PER_DAY, 'daily_grant')
  return created
}


async function handleSuccessfulPayment(payment: { invoice_payload: string; total_amount: number; telegram_payment_charge_id: string }) {
  const [prefix, userIdStr, packageId] = payment.invoice_payload.split(':')
  if (prefix !== 'coins') return

  const pkg = COIN_PACKAGES.find((p) => p.id === packageId)
  const userId = Number(userIdStr)
  if (!pkg || Number.isNaN(userId)) return

  const { error } = await supabase.from('coin_purchases').insert({
    user_id: userId,
    telegram_charge_id: payment.telegram_payment_charge_id,
    stars_amount: payment.total_amount,
    coins_amount: pkg.coins,
  })
  if (error) {
    if (error.code === '23505') return // already processed this charge
    throw error
  }

  await creditCoins(userId, pkg.coins, 'purchase')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update.message

    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query
      const [prefix, userId, packageId] = query.invoice_payload.split(':')
      const valid = prefix === 'coins' && !Number.isNaN(Number(userId)) && COIN_PACKAGES.some((p) => p.id === packageId)
      await answerPreCheckoutQuery(BOT_TOKEN, query.id, valid, valid ? undefined : 'Invalid order')
      return res.status(200).json({ ok: true })
    }

    if (message?.successful_payment) {
      await handleSuccessfulPayment(message.successful_payment)
      return res.status(200).json({ ok: true })
    }

    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

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
