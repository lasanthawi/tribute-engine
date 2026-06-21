import { NextApiRequest, NextApiResponse } from 'next'
import {
  approveJoinRequest,
  autoLinkChatToCommunity,
  findCommunityForChat,
  grantMemberAccess,
  recordJoinRequest,
  syncCommunityAvatar,
  syncDiscussionBotStatus,
  syncDiscussionChat,
  upsertTelegramChat,
} from '@/lib/access-control'
import { findInvoiceByPayload, recordSuccessfulPayment } from '@/lib/payments'
import { recordClickByCode, registerReferredJoin } from '@/lib/referrals'
import { parseOfferCode } from '@/lib/start-params'
import { answerPreCheckoutQuery, sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
import { getOrCreateUser } from '@/lib/telegram-auth'
import { supabase } from '@/lib/supabase'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function miniAppBaseUrl() {
  return MINI_APP_URL.replace(/\/$/, '')
}

function inlineKeyboard(url = MINI_APP_URL, label = 'Open CommunityOS') {
  return url ? { inline_keyboard: [[{ text: label, web_app: { url } }]] } : undefined
}

function parseStartParam(value?: string) {
  if (!value) return null
  const offer = parseOfferCode(value)
  if (offer) return offer
  const community = /^(?:community_|co_)(\d+)(?:_\d+)?$/.exec(value)
  if (community) return { communityId: Number(community[1]), kind: null, itemId: null }
  return null
}

function miniAppUrlForStartParam(startParam?: string) {
  const base = miniAppBaseUrl()
  if (!base) return ''
  const parsed = parseStartParam(startParam)
  if (!parsed?.communityId) return base
  if (parsed.kind && parsed.itemId) return `${base}/member/${parsed.communityId}?${parsed.kind}=${parsed.itemId}`
  return `${base}/member/${parsed.communityId}`
}

function buttonTextForStartParam(startParam?: string) {
  const parsed = parseStartParam(startParam)
  if (parsed?.kind === 'plan') return 'Continue to Subscribe'
  if (parsed?.kind === 'product') return 'Continue to Buy'
  if (parsed?.kind === 'event') return 'Continue to Register'
  return 'Open CommunityOS'
}

function textForStartParam(startParam?: string) {
  const parsed = parseStartParam(startParam)
  if (parsed?.kind === 'plan') return '*CommunityOS*\n\nOpen the Mini App to review and continue your subscription.'
  if (parsed?.kind === 'product') return '*CommunityOS*\n\nOpen the Mini App to review and continue your product purchase.'
  if (parsed?.kind === 'event') return '*CommunityOS*\n\nOpen the Mini App to review and continue your event registration.'
  if (parsed?.communityId) return '*CommunityOS*\n\nOpen the Mini App to view this community as a member.'
  return '*CommunityOS*\n\nManage memberships, referrals, rewards, and member access for Telegram communities.'
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
      const invoiceAmount = Number(invoice?.stars ?? 0)
      const invoiceStatus = String(invoice?.status ?? '')
      const ok =
        !!isStars &&
        !!invoice &&
        invoiceStatus === 'created' &&
        invoiceAmount === update.pre_checkout_query.total_amount
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
      if (result.ok && result.communityId && !result.productId && !result.eventId && !result.alreadyPaid) {
        const grant = await grantMemberAccess(result.communityId, user.id)
        inviteLink = grant.inviteLink
      }

      const confirmText = result.ok
        ? inviteLink
          ? `*Payment confirmed* ✅\n\nHere is your invite link:\n${inviteLink}\n\n_This link is single-use — do not share it._`
          : '*Payment confirmed* ✅\n\nYour access is being activated. The community admin will share an invite link shortly.'
        : '*Payment received, review needed*\n\nWe could not match the invoice automatically. Support will review it shortly.'

      const finalConfirmText =
        result.ok && result.productId
          ? '*Payment confirmed*\n\nYour product is unlocked in CommunityOS. Open the Mini App to access it.'
          : result.ok && result.eventId
          ? '*Registration confirmed*\n\nYour event access is unlocked in CommunityOS. Open the Mini App for details.'
          : confirmText

      const baseUrl = miniAppBaseUrl()
      const resultUrl = result.ok && result.communityId && baseUrl ? `${baseUrl}/member/${result.communityId}` : MINI_APP_URL
      await sendTelegramMessage(BOT_TOKEN, message.chat.id, finalConfirmText, 'Markdown', inlineKeyboard(resultUrl, 'Open Member Dashboard'))
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
          communityId = await autoLinkChatToCommunity(mcm.from.id, telegramChatId, mcm.chat.title)
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
            await syncCommunityAvatar(communityId, mcm.chat.id).catch((error) => console.error('syncCommunityAvatar failed:', error))
            await syncDiscussionChat(communityId, telegramChatId).catch((error) => console.error('syncDiscussionChat failed:', error))
          }
        }

        if (botRemoved && communityId) {
          await upsertTelegramChat({
            communityId,
            telegramChatId,
            title: mcm.chat.title,
            handle: mcm.chat.username ?? null,
            chatType: mcm.chat.type as 'group' | 'supergroup' | 'channel',
            botStatus: 'not_connected',
          }).catch(() => undefined)
        }

        // This event may instead describe the bot's membership in a linked discussion
        // group, which has no direct community_id of its own — match it back to whichever
        // channel row already recorded this chat as its discussion_chat_id.
        await syncDiscussionBotStatus(telegramChatId, botIsAdmin ? 'admin' : botRemoved ? 'not_connected' : 'missing_permissions').catch(
          (error) => console.error('syncDiscussionBotStatus failed:', error)
        )
      }

      return res.status(200).json({ ok: true })
    }

    if (update.chat_join_request) {
      const join = update.chat_join_request
      const communityId = await findCommunityForChat(String(join.chat.id))
      if (communityId) {
        await upsertTelegramChat({
          communityId,
          telegramChatId: String(join.chat.id),
          title: join.chat.title,
          handle: join.chat.username ?? null,
          chatType: join.chat.type,
          botStatus: 'admin',
        }).catch(() => undefined)

        const user = await getOrCreateUser(join.from)
        const { data: activeSub } = await supabase
          .from('member_subscriptions')
          .select('id')
          .eq('community_id', communityId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()

        const request = await recordJoinRequest({
          communityId,
          telegramChatId: String(join.chat.id),
          telegramUserId: String(join.from.id),
          username: join.from.username ?? null,
        })

        if (activeSub?.id) {
          await approveJoinRequest(communityId, request.id, null).catch((error) => console.error('auto approve join failed:', error))
          await grantMemberAccess(communityId, user.id)
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
        textForStartParam(startParam),
        'Markdown',
        inlineKeyboard(miniAppUrlForStartParam(startParam), buttonTextForStartParam(startParam))
      )
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('telegram/webhook error:', error)
    res.status(200).json({ ok: true })
  }
}
