import { sendTelegramMessage } from './telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function inlineKeyboard() {
  return MINI_APP_URL ? { inline_keyboard: [[{ text: 'Open CommunityOS', web_app: { url: MINI_APP_URL } }]] } : undefined
}

export async function sendWelcomeMessage(telegramId: number, communityName: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `Welcome to *${communityName}*. Your CommunityOS profile is ready.`,
      'Markdown',
      inlineKeyboard()
    )
  } catch (error) {
    console.error('sendWelcomeMessage error:', error)
  }
}
