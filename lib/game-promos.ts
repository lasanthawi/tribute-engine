// VOTE LEAGUE — announcements for autonomously-published mini-games

import { sendTelegramPhoto, sendTelegramMessage } from './telegram'
import { CatalogGame } from './games-catalog'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const OFFICIAL_CHANNEL_ID = process.env.OFFICIAL_CHANNEL_ID || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''

function appKeyboard() {
  return MINI_APP_URL
    ? { inline_keyboard: [[{ text: '▶ Play now', web_app: { url: `${MINI_APP_URL}/games` } }]] }
    : undefined
}

/**
 * Best-effort announcement of a newly-published game to the official
 * channel — no-op if BOT_TOKEN/OFFICIAL_CHANNEL_ID are unset, never throws.
 */
export async function announceNewGame(game: CatalogGame, promoCopy: string): Promise<void> {
  if (!BOT_TOKEN || !OFFICIAL_CHANNEL_ID) return
  const caption = `🆕 New game: *${game.title}* ${game.icon}\n${promoCopy}`
  try {
    if (game.coverImageUrl && game.coverImageUrl.startsWith('http')) {
      await sendTelegramPhoto(BOT_TOKEN, OFFICIAL_CHANNEL_ID, game.coverImageUrl, caption, appKeyboard())
    } else {
      await sendTelegramMessage(BOT_TOKEN, OFFICIAL_CHANNEL_ID, caption, 'Markdown', appKeyboard())
    }
  } catch (error) {
    console.error('announceNewGame error:', error)
  }
}

/**
 * Best-effort admin notification (e.g. a proposal failed the test gate and
 * was retired instead of published) — no-op if BOT_TOKEN/admin id unset.
 */
export async function notifyAdmins(text: string): Promise<void> {
  if (!BOT_TOKEN) return
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const id of adminIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, id, text, 'Markdown')
    } catch (error) {
      console.error('notifyAdmins error:', error)
    }
  }
}
