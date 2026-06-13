import axios from 'axios'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  replyMarkup?: any
) {
  try {
    const response = await axios.post(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
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
  caption?: string,
  replyMarkup?: any
) {
  try {
    const response = await axios.post(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`,
      {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }
    )
    return response.data
  } catch (error) {
    console.error('Telegram photo error:', error)
    throw error
  }
}

/** Creates a Telegram Stars (XTR) invoice link for a Mini App purchase. */
export async function createInvoiceLink(
  botToken: string,
  title: string,
  description: string,
  payload: string,
  starsAmount: number
): Promise<string> {
  const response = await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/createInvoiceLink`, {
    title,
    description,
    payload,
    currency: 'XTR',
    prices: [{ label: title, amount: starsAmount }],
  })
  return response.data.result as string
}

/** Must be answered within 10s of a pre_checkout_query update. */
export async function answerPreCheckoutQuery(
  botToken: string,
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string
) {
  try {
    await axios.post(`${TELEGRAM_API_BASE}/bot${botToken}/answerPreCheckoutQuery`, {
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    })
  } catch (error) {
    console.error('answerPreCheckoutQuery error:', error)
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
    successful_payment?: SuccessfulPayment
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
  pre_checkout_query?: {
    id: string
    from: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    currency: string
    total_amount: number
    invoice_payload: string
  }
}

/** Present on `message` updates when a Stars payment completes. */
export interface SuccessfulPayment {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
  provider_payment_charge_id: string
}
