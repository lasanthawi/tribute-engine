export interface TelegramUpdate {
  message?: {
    chat: { id: number }
    from?: { id: number; username?: string; first_name?: string; last_name?: string }
    text?: string
    successful_payment?: {
      currency: string
      total_amount: number
      invoice_payload: string
      telegram_payment_charge_id?: string
      provider_payment_charge_id?: string
    }
  }
  pre_checkout_query?: {
    id: string
    from: { id: number; username?: string; first_name?: string; last_name?: string }
    currency: string
    total_amount: number
    invoice_payload: string
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

export async function createChatInviteLink(
  botToken: string,
  chatId: number | string,
  opts: { memberLimit?: number; expireDate?: number; createsJoinRequest?: boolean } = {}
): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      member_limit: opts.createsJoinRequest ? undefined : opts.memberLimit ?? 1,
      expire_date: opts.expireDate,
      creates_join_request: opts.createsJoinRequest ?? false,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) {
    throw new Error(`Telegram createChatInviteLink failed: ${res.status} ${body?.description ?? ''}`)
  }
  return body.result.invite_link as string
}

export async function answerPreCheckoutQuery(botToken: string, preCheckoutQueryId: string, ok: boolean, errorMessage?: string): Promise<void> {
  if (!botToken) return

  const res = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    }),
  })

  if (!res.ok) {
    throw new Error(`Telegram answerPreCheckoutQuery failed: ${res.status}`)
  }
}
