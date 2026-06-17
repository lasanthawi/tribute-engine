import { NextApiRequest, NextApiResponse } from 'next'
import { grantMemberAccess } from '@/lib/access-control'
import { findInvoiceByPayload, recordSuccessfulPayment } from '@/lib/payments'
import { recordClickByCode, registerReferredJoin } from '@/lib/referrals'
import { isDemoMode } from '@/lib/supabase'
import { answerPreCheckoutQuery, sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
import { getOrCreateUser } from '@/lib/telegram-auth'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function inlineKeyboard() {
  return MINI_APP_URL ? { inline_keyboard: [[{ text: 'Open CommunityOS', web_app: { url: MINI_APP_URL } }]] } : undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    if (update.pre_checkout_query) {
      const isStars = update.pre_checkout_query.currency === 'XTR'
      const invoice = isDemoMode ? true : await findInvoiceByPayload(update.pre_checkout_query.invoice_payload)
      const ok = !!isStars && !!invoice
      await answerPreCheckoutQuery(
        BOT_TOKEN,
        update.pre_checkout_query.id,
        ok,
        ok ? undefined : 'This CommunityOS invoice is no longer valid.'
      )
      return res.status(200).json({ ok: true })
    }

    const message = update.message
    if (message?.successful_payment && message.from) {
      const user = await getOrCreateUser(message.from)
      const payment = message.successful_payment
      const result = isDemoMode
        ? { ok: true as const, communityId: null }
        : await recordSuccessfulPayment({
            payload: payment.invoice_payload,
            stars: payment.total_amount,
            buyerUserId: user.id,
            telegramChargeId: payment.telegram_payment_charge_id ?? null,
            providerChargeId: payment.provider_payment_charge_id ?? null,
          })

      if (result.ok && result.communityId) {
        await grantMemberAccess(result.communityId, user.id)
      }

      await sendTelegramMessage(
        BOT_TOKEN,
        message.chat.id,
        result.ok
          ? '*Payment confirmed*\n\nYour CommunityOS access, product, event, or consultation purchase is being activated.'
          : '*Payment received, review needed*\n\nWe could not match the invoice automatically. Support will review it.',
        'Markdown',
        inlineKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    if (message.text.startsWith('/start')) {
      const startParam = message.text.split(/\s+/)[1]
      const user = await getOrCreateUser(message.from)
      if (startParam && !isDemoMode) {
        await recordClickByCode(startParam, String(message.from.id))
        await registerReferredJoin(startParam, user.id)
      }
      await sendTelegramMessage(
        BOT_TOKEN,
        message.chat.id,
        startParam
          ? `*CommunityOS*\n\nReferral code received: \`${startParam}\`.\nOpen the Mini App to continue.`
          : '*CommunityOS*\n\nManage memberships, referrals, rewards, and member access for Telegram communities.',
        'Markdown',
        inlineKeyboard()
      )
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram/webhook error:', error)
    res.status(200).json({ ok: true })
  }
}
