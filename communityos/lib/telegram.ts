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
  chat_join_request?: {
    chat: { id: number; title: string; type: 'group' | 'supergroup' | 'channel'; username?: string }
    from: { id: number; username?: string; first_name?: string; last_name?: string }
    invite_link?: { invite_link?: string; creates_join_request?: boolean }
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
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

  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.ok === false) {
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body?.description ?? ''}`.trim())
  }
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: number | string,
  photo: string,
  caption: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  replyMarkup?: unknown
): Promise<void> {
  if (!botToken) return

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: parseMode,
      reply_markup: replyMarkup,
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.ok === false) {
    throw new Error(`Telegram sendPhoto failed: ${res.status} ${body?.description ?? ''}`.trim())
  }
}

export interface TelegramChatInfo {
  id: number
  title?: string
  photoBigFileId?: string | null
  linkedChatId?: number | null
}

export async function getChat(botToken: string, chatId: number | string): Promise<TelegramChatInfo | null> {
  if (!botToken) return null
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram getChat failed: ${res.status} ${body?.description ?? ''}`)
  const result = body.result ?? {}
  return {
    id: result.id,
    title: result.title,
    photoBigFileId: result.photo?.big_file_id ?? null,
    linkedChatId: result.linked_chat_id ?? null,
  }
}

export async function getFile(botToken: string, fileId: string): Promise<string | null> {
  if (!botToken) return null
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram getFile failed: ${res.status} ${body?.description ?? ''}`)
  return body.result?.file_path ?? null
}

export async function setChatPermissions(
  botToken: string,
  chatId: number | string,
  permissions: { can_send_messages?: boolean; can_send_other_messages?: boolean }
): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatPermissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, permissions }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram setChatPermissions failed: ${res.status} ${body?.description ?? ''}`)
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

export async function approveChatJoinRequest(botToken: string, chatId: number | string, userId: number | string): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/approveChatJoinRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram approveChatJoinRequest failed: ${res.status} ${body?.description ?? ''}`)
}

export async function declineChatJoinRequest(botToken: string, chatId: number | string, userId: number | string): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/declineChatJoinRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram declineChatJoinRequest failed: ${res.status} ${body?.description ?? ''}`)
}

export async function banChatMember(botToken: string, chatId: number | string, userId: number | string): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/banChatMember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram banChatMember failed: ${res.status} ${body?.description ?? ''}`)
}

export async function unbanChatMember(botToken: string, chatId: number | string, userId: number | string): Promise<void> {
  if (!botToken) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/unbanChatMember`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: true }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram unbanChatMember failed: ${res.status} ${body?.description ?? ''}`)
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

export async function setTelegramWebhook(botToken: string, url: string, secretToken?: string, opts: { dropPendingUpdates?: boolean } = {}): Promise<void> {
  if (!botToken || !url) return
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      allowed_updates: ['message', 'pre_checkout_query', 'chat_join_request', 'my_chat_member'],
      secret_token: secretToken || undefined,
      drop_pending_updates: opts.dropPendingUpdates ?? false,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram setWebhook failed: ${res.status} ${body?.description ?? ''}`)
}

export async function getTelegramWebhookInfo(botToken: string): Promise<{
  url: string
  pendingUpdateCount: number
  lastErrorDate?: number
  lastErrorMessage?: string
  allowedUpdates: string[]
} | null> {
  if (!botToken) return null
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body?.ok) throw new Error(`Telegram getWebhookInfo failed: ${res.status} ${body?.description ?? ''}`)
  return {
    url: body.result?.url ?? '',
    pendingUpdateCount: body.result?.pending_update_count ?? 0,
    lastErrorDate: body.result?.last_error_date,
    lastErrorMessage: body.result?.last_error_message,
    allowedUpdates: body.result?.allowed_updates ?? [],
  }
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
