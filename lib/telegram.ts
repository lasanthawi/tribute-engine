import axios from 'axios'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
) {
  try {
    const response = await axios.post(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }
    )
    return response.data
  } catch (error) {
    console.error('Telegram send error:', error)
    throw error
  }
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photoUrl: string,
  caption?: string
) {
  try {
    const response = await axios.post(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`,
      {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'Markdown',
      }
    )
    return response.data
  } catch (error) {
    console.error('Telegram photo error:', error)
    throw error
  }
}

export async function setWebhook(botToken: string, webhookUrl: string) {
  try {
    const response = await axios.post(
      `${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`,
      {
        url: webhookUrl,
      }
    )
    return response.data
  } catch (error) {
    console.error('Webhook setup error:', error)
    throw error
  }
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
