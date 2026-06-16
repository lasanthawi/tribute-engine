import axios from 'axios'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

/** Pause for `ms` milliseconds — useful for respecting Telegram's 30 msg/sec rate limit. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'HTML',
  replyMarkup?: object,
): Promise<void> {
  await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
    disable_web_page_preview: true,
  })
}

/** Convenience wrapper — always uses HTML parse mode. */
export async function sendHtml(
  botToken: string,
  chatId: number | string,
  html: string,
  replyMarkup?: object,
): Promise<void> {
  await sendTelegramMessage(botToken, chatId, html, 'HTML', replyMarkup)
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  replyMarkup?: object,
): Promise<void> {
  await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`, {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  })
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string): Promise<void> {
  await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
    text,
  })
}

export async function setWebhook(botToken: string, webhookUrl: string): Promise<void> {
  await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, { url: webhookUrl })
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    date: number
    text?: string
  }
  callback_query?: {
    id: string
    from: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    chat_instance: string
    data?: string
  }
}
