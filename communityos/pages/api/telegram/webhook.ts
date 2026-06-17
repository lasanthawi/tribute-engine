import { NextApiRequest, NextApiResponse } from 'next'
import { autoLinkChatToCommunity, findCommunityForChat, grantMemberAccess, upsertTelegramChat } from '@/lib/access-control'
import { findInvoiceByPayload, recordSuccessfulPayment } from '@/lib/payments'
import { recordClickByCode, registerReferredJoin } from '@/lib/referrals'
import { answerPreCheckoutQuery, sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
import { getOrCreateUser } from '@/lib/telegram-auth'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function inlineKeyboard() {
  return MINI_APP_URL ? { inline_keyboard: [[{ text: 'Open CommunityOS', web_app: { url: MINI_APP_URL } }]] } : undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid Telegram webhook secret' })
  }

  try {
    const update: TelegramUpdate = req.body
    if (update.pre_checkout_query) {
      const isStars = update.pre_checkout_query.currency === 'XTR'
      const invoice = await findInvoiceByPayload(update.pre_checkout_query.invoice_payload)
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
      const result = await recordSuccessfulPayment({
            payload: payment.invoice_payload,
            stars: payment.total_amount,
            buyerUserId: user.id,
            telegramChargeId: payment.telegram_payment_charge_id ?? null,
            providerChargeId: payment.provider_payment_charge_id ?? null,
          })

      let inviteLink: string | null = null
      if (result.ok && result.communityId) {
        const grant = await grantMemberAccess(result.communityId, user.id)
        inviteLink = grant.inviteLink
      }

      const confirmText = result.ok
        ? inviteLink
          ? `*Payment confirmed* ✅\n\nHere is your invite link:\n${inviteLink}\n\n_This link is single-use — do not share it._`
          : '*Payment confirmed* ✅\n\nYour access is being activated. The community admin will share an invite link shortly.'
        : '*Payment received, review needed*\n\nWe could not match the invoice automatically. Support will review it shortly.'

      await sendTelegramMessage(BOT_TOKEN, message.chat.id, confirmText, 'Markdown', inlineKeyboard())
      return res.status(200).json({ ok: true })
    }

    // Bot added to / removed from a chat
    if (update.my_chat_member) {
      const mcm = update.my_chat_member
      const telegramChatId = String(mcm.chat.id)
      const newStatus = mcm.new_chat_member.status
      const botIsAdmin = newStatus === 'administrator' || newStatus === 'creator'
      const botRemoved = newStatus === 'left' || newStatus === 'kicked'

      if (mcm.chat.type !== 'private') {
        let communityId = await findCommunityForChat(telegramChatId)
        if (!communityId && botIsAdmin) {
          communityId = await autoLinkChatToCommunity(mcm.from.id, telegramChatId)
        }

        if (communityId) {
          await upsertTelegramChat({
            communityId,
            telegramChatId,
            title: mcm.chat.title,
            handle: mcm.chat.username ?? null,
            chatType: mcm.chat.type as 'group' | 'supergroup' | 'channel',
            botStatus: botIsAdmin ? 'admin' : 'not_connected',
          })

          if (botIsAdmin) {
            await sendTelegramMessage(
              BOT_TOKEN,
              mcm.chat.id,
              '*CommunityOS connected* ✅\n\nAccess control is active. Paying members will receive invite links automatically.',
              'Markdown'
            )
          }
        }

        if (botRemoved) {
          console.log(`Bot removed from chat ${telegramChatId} (community ${communityId ?? 'unknown'})`)
        }
      }

      return res.status(200).json({ ok: true })
    }

    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    if (message.text.startsWith('/start')) {
      const startParam = message.text.split(/\s+/)[1]
      const user = await getOrCreateUser(message.from)
      if (startParam) {
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
