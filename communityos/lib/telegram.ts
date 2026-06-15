export interface TelegramUpdate {
  message?: {
    chat: { id: number }
    from?: { id: number; username?: string; first_name?: string; last_name?: string }
    text?: string
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  replyMarkup?: unknown
): Promise<void> {
  if (!botToken) return

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: replyMarkup,
    }),
  })

  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.status}`)
  }
}
