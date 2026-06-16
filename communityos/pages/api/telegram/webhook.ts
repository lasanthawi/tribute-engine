import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage, TelegramUpdate } from '@/lib/telegram'
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
    const message = update.message
    if (!message?.text || !message.from) return res.status(200).json({ ok: true })

    if (message.text.startsWith('/start')) {
      await getOrCreateUser(message.from)
      await sendTelegramMessage(
        BOT_TOKEN,
        message.chat.id,
        '*CommunityOS*\n\nManage memberships, referrals, rewards, and member access for Telegram communities.',
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
