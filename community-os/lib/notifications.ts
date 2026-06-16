import { sendTelegramMessage } from './telegram'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

/** Best-effort event reminder — never throws. */
export async function sendEventReminder(telegramId: number, eventTitle: string, eventAt: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const date = new Date(eventAt).toUTCString()
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `📅 Reminder: *${eventTitle}* is coming up on ${date}`,
      'Markdown'
    )
  } catch (error) {
    console.error('sendEventReminder error:', error)
  }
}

/** Best-effort custom broadcast — never throws. Returns count of successful sends. */
export async function broadcastCustomMessage(telegramIds: number[], text: string): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0

  let count = 0
  for (const telegramId of telegramIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, telegramId, text, 'Markdown')
      count++
    } catch (error) {
      console.error('broadcastCustomMessage error:', error)
    }
  }
  return count
}
