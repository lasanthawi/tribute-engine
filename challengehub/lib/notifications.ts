import { sendTelegramMessage } from './telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function inlineKeyboard() {
  return MINI_APP_URL ? { inline_keyboard: [[{ text: '▶ Open ChallengeHub', web_app: { url: MINI_APP_URL } }]] } : undefined
}

/** Best-effort reminder to complete today's task — never throws. */
export async function sendTaskReminder(telegramId: number, challengeTitle: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `⏰ Don't forget today's check-in for *${challengeTitle}* — keep your streak alive!`,
      'Markdown',
      inlineKeyboard()
    )
  } catch (error) {
    console.error('sendTaskReminder error:', error)
  }
}

/** Best-effort notification that a new challenge has gone live — one message per user, never throws. */
export async function broadcastChallengeLive(telegramIds: number[], challengeTitle: string): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0

  const text = `🚀 *${challengeTitle}* is now live! Join now and start earning XP.`
  let notified = 0

  for (const telegramId of telegramIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, telegramId, text, 'Markdown', inlineKeyboard())
      notified++
    } catch (error) {
      console.error('broadcastChallengeLive error:', error)
    }
  }

  return notified
}

/** Best-effort custom broadcast (used by the bot's /broadcast admin command). */
export async function broadcastCustomMessage(telegramIds: number[], text: string): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0

  let count = 0
  for (const telegramId of telegramIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, telegramId, text, 'Markdown', inlineKeyboard())
      count++
    } catch (error) {
      console.error('broadcastCustomMessage error:', error)
    }
  }
  return count
}
