import { sendTelegramMessage } from './telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function inlineKeyboard() {
  return MINI_APP_URL ? { inline_keyboard: [[{ text: '▶ Open VOTE LEAGUE', web_app: { url: MINI_APP_URL } }]] } : undefined
}

/** Best-effort reminder to keep a streak alive — never throws. */
export async function sendStreakReminder(telegramId: number, streakCount: number): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `🔥 Your *${streakCount}-day streak* is about to expire! Cast a vote today to keep it alive.`,
      'Markdown',
      inlineKeyboard()
    )
  } catch (error) {
    console.error('sendStreakReminder error:', error)
  }
}

/** Best-effort broadcast when new Main Vote rounds open — one message per user, never throws. */
export async function broadcastMainRoundsOpen(telegramIds: number[], assets: string[]): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0 || assets.length === 0) return 0

  const text = `🆕 Today's Main Votes are open: ${assets.join(', ')} — cast your calls!`
  let notified = 0

  for (const telegramId of telegramIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, telegramId, text, 'Markdown', inlineKeyboard())
      notified++
    } catch (error) {
      console.error('broadcastMainRoundsOpen error:', error)
    }
  }

  return notified
}
