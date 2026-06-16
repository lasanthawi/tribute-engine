/**
 * High-level notification helpers — never throw, always best-effort.
 * All messages use HTML formatting via sendHtml.
 */
import { sendHtml, sleep } from './telegram'
import {
  appKeyboard,
  joinKeyboard,
  dailyReminderMessage,
  streakAlertMessage,
  challengeGoLiveMessage,
  levelUpMessage,
  challengeCompleteMessage,
  weeklyDigestMessage,
  DailyReminderOpts,
  StreakAlertOpts,
  ChallengeGoLiveOpts,
  LevelUpOpts,
  ChallengeCompleteOpts,
  WeeklyDigestOpts,
} from './bot-messages'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

// ─── Individual DM notifications ─────────────────────────────────────────────

export async function sendDailyReminder(telegramId: number, opts: DailyReminderOpts): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendHtml(BOT_TOKEN, telegramId, dailyReminderMessage(opts), appKeyboard('✅ Check In Now'))
  } catch (err) {
    console.error('[notifications] sendDailyReminder failed', { telegramId, err })
  }
}

export async function sendStreakAlert(telegramId: number, opts: StreakAlertOpts): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendHtml(BOT_TOKEN, telegramId, streakAlertMessage(opts), appKeyboard('⚡ Check In Now'))
  } catch (err) {
    console.error('[notifications] sendStreakAlert failed', { telegramId, err })
  }
}

export async function sendLevelUpCelebration(telegramId: number, opts: LevelUpOpts): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendHtml(BOT_TOKEN, telegramId, levelUpMessage(opts), appKeyboard())
  } catch (err) {
    console.error('[notifications] sendLevelUpCelebration failed', { telegramId, err })
  }
}

export async function sendChallengeComplete(telegramId: number, opts: ChallengeCompleteOpts): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendHtml(BOT_TOKEN, telegramId, challengeCompleteMessage(opts), appKeyboard('🎁 Claim Reward'))
  } catch (err) {
    console.error('[notifications] sendChallengeComplete failed', { telegramId, err })
  }
}

// ─── Broadcast helpers ────────────────────────────────────────────────────────

/**
 * Sends a challenge go-live announcement to every user in telegramIds.
 * Returns the number of messages successfully delivered.
 */
export async function broadcastChallengeLive(telegramIds: number[], opts: ChallengeGoLiveOpts): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0
  const text = challengeGoLiveMessage(opts)
  const keyboard = joinKeyboard()
  let sent = 0

  for (const id of telegramIds) {
    try {
      await sendHtml(BOT_TOKEN, id, text, keyboard)
      sent++
    } catch (err) {
      console.error('[notifications] broadcastChallengeLive failed for', id, err)
    }
    await sleep(40) // ~25 msg/sec — safe under Telegram's 30/sec limit
  }
  return sent
}

/**
 * Sends a pre-formatted HTML message to a list of Telegram IDs.
 * Used by the /broadcast admin command and the weekly digest.
 */
export async function broadcastHtml(telegramIds: number[], html: string, keyboard?: object): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0
  let sent = 0

  for (const id of telegramIds) {
    try {
      await sendHtml(BOT_TOKEN, id, html, keyboard)
      sent++
    } catch (err) {
      console.error('[notifications] broadcastHtml failed for', id, err)
    }
    await sleep(40)
  }
  return sent
}

/** Legacy plain-text broadcast — kept for the /broadcast bot command. */
export async function broadcastCustomMessage(telegramIds: number[], text: string): Promise<number> {
  return broadcastHtml(telegramIds, text, appKeyboard())
}

/**
 * Sends the weekly digest to a Telegram channel (if TELEGRAM_CHANNEL_ID is set)
 * and optionally to all individual users.
 */
export async function sendWeeklyDigest(opts: WeeklyDigestOpts, broadcastToUsers?: number[]): Promise<void> {
  if (!BOT_TOKEN) return
  const text = weeklyDigestMessage(opts)
  const keyboard = appKeyboard()

  // Channel post (public announcement)
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (channelId) {
    try {
      await sendHtml(BOT_TOKEN, channelId, text, keyboard)
    } catch (err) {
      console.error('[notifications] sendWeeklyDigest channel failed', err)
    }
  }

  // Optional DM broadcast to all users
  if (broadcastToUsers && broadcastToUsers.length > 0) {
    await broadcastHtml(broadcastToUsers, text, keyboard)
  }
}

// ─── Legacy alias (used by old task_submissions flow) ────────────────────────
export async function sendTaskReminder(telegramId: number, challengeTitle: string): Promise<void> {
  await sendDailyReminder(telegramId, {
    challengeTitle,
    category: 'general',
    taskTitle: 'Daily check-in',
    xpReward: 20,
    dayNumber: 1,
    totalDays: 7,
    streak: 0,
  })
}
