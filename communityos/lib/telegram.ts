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
  /** Fired when the bot's membership status changes in a chat (added as admin, removed, etc.) */
  my_chat_member?: {
    chat: { id: number; title: string; type: 'group' | 'supergroup' | 'channel' | 'private'; username?: string }
    from: { id: number; username?: string; first_name?: string }
    new_chat_member: { status: 'administrator' | 'creator' | 'member' | 'restricted' | 'left' | 'kicked' }
    old_chat_member: { status: 'administrator' | 'creator' | 'member' | 'restricted' | 'left' | 'kicked' }
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

export async function createTelegramInvoiceLink(
  botToken: string,
  invoice: { title: string; description: string; payload: string; currency: string; prices: Array<{ label: string; amount: number }> }
): Promise<string | null> {
  if (!botToken) return null

  const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: invoice.title,
      description: invoice.description,
      payload: invoice.payload,
      currency: invoice.currency,
      prices: invoice.prices,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) {
    throw new Error(`Telegram createInvoiceLink failed: ${res.status} ${body?.description ?? ''}`)
  }
  return body.result as string
}

export async function setTelegramWebhook(botToken: string, url: string, secretToken?: string): Promise<void> {
  if (!botToken || !url) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      allowed_updates: ['message', 'pre_checkout_query', 'chat_join_request', 'my_chat_member'],
      secret_token: secretToken || undefined,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram setWebhook failed: ${res.status} ${body?.description ?? ''}`)
}

export async function setTelegramMenuButton(botToken: string, miniAppUrl: string): Promise<void> {
  if (!botToken || !miniAppUrl) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Open CommunityOS',
        web_app: { url: miniAppUrl },
      },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram setChatMenuButton failed: ${res.status} ${body?.description ?? ''}`)
}

export async function setTelegramCommands(botToken: string): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Open CommunityOS' },
        { command: 'help', description: 'How CommunityOS works' },
      ],
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram setMyCommands failed: ${res.status} ${body?.description ?? ''}`)
}
