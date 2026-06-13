import { sendTelegramMessage } from './telegram'
import { Asset } from './supabase'
import { UnlockedAchievement } from './achievements'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || ''
const MINI_APP_URL = process.env.MINI_APP_URL || ''
const OFFICIAL_CHANNEL_ID = process.env.OFFICIAL_CHANNEL_ID || ''

function openAppButton() {
  return MINI_APP_URL ? { text: '▶ Open VOTE LEAGUE', web_app: { url: MINI_APP_URL } } : undefined
}

/** Single-row "Open VOTE LEAGUE" inline keyboard, or undefined if MINI_APP_URL unset. */
function appKeyboard(): { inline_keyboard: { text: string; web_app: { url: string } }[][] } | undefined {
  const button = openAppButton()
  return button ? { inline_keyboard: [[button]] } : undefined
}

/** Builds a Telegram "share to chat" link pre-filled with the user's referral link, or null if not configured. */
export function getReferralShareLink(telegramId: number): string | null {
  if (!BOT_USERNAME) return null
  const referralUrl = `https://t.me/${BOT_USERNAME}?start=ref_${telegramId}`
  const text = '🗳️ I\'m playing VOTE LEAGUE — daily crypto UP/DOWN calls. Join me and grab your free tickets!'
  return `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`
}

/** Best-effort milestone DM for a newly-unlocked achievement — never throws. */
export async function sendMilestoneCelebration(telegramId: number, achievement: UnlockedAchievement): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const row1 = openAppButton()
    const shareLink = getReferralShareLink(telegramId)
    const keyboard: { text: string; web_app?: { url: string }; url?: string }[][] = []
    if (row1) keyboard.push([row1])
    if (shareLink) keyboard.push([{ text: '📤 Share', url: shareLink }])

    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `🏆 Achievement unlocked: *${achievement.title}*\n${achievement.icon} ${achievement.description}`,
      'Markdown',
      keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
    )
  } catch (error) {
    console.error('sendMilestoneCelebration error:', error)
  }
}

/** Best-effort DM when a quest completes — never throws. */
export async function sendQuestCompletedCelebration(telegramId: number, questTitle: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `🎯 Quest complete: *${questTitle}*!\nClaim your reward in the Quests tab.`,
      'Markdown',
      appKeyboard()
    )
  } catch (error) {
    console.error('sendQuestCompletedCelebration error:', error)
  }
}

/** Best-effort post to the official channel/group — no-op if OFFICIAL_CHANNEL_ID unset, never throws. */
export async function postToChannel(text: string): Promise<void> {
  if (!BOT_TOKEN || !OFFICIAL_CHANNEL_ID) return
  try {
    await sendTelegramMessage(BOT_TOKEN, OFFICIAL_CHANNEL_ID, text, 'Markdown', appKeyboard())
  } catch (error) {
    console.error('postToChannel error:', error)
  }
}

/** Best-effort "big win" announcement to the official channel — never throws. */
export async function postBigWinAnnouncement(username: string | null, asset: Asset, pointsEarned: number): Promise<void> {
  const who = username ? `@${username}` : 'A VOTE LEAGUE player'
  await postToChannel(`🔥 ${who} just scored *+${pointsEarned} pts* on a ${asset} call!`)
}

/** Best-effort weekly digest post to the official channel — never throws. */
export async function postWeeklyDigest(topUsers: { username: string; points: number }[], totalVotes: number): Promise<void> {
  if (topUsers.length === 0 && totalVotes === 0) return
  const lines = topUsers
    .slice(0, 5)
    .map((u, i) => `${i + 1}. ${u.username} — ${u.points} pts`)
    .join('\n')
  await postToChannel(`📊 *This Week in VOTE LEAGUE*\n\n${lines}\n\n🗳️ ${totalVotes} votes cast this week — join in!`)
}

/** Best-effort win-back nudge for inactive users — never throws. */
export async function sendWinBackNudge(telegramId: number): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    await sendTelegramMessage(
      BOT_TOKEN,
      telegramId,
      `👋 We miss you at VOTE LEAGUE! Here's a free ticket on us — come cast your vote.`,
      'Markdown',
      appKeyboard()
    )
  } catch (error) {
    console.error('sendWinBackNudge error:', error)
  }
}

/** Best-effort broadcast of a custom admin message to a list of users — never throws. */
export async function broadcastCustomMessage(telegramIds: number[], text: string): Promise<number> {
  if (!BOT_TOKEN || telegramIds.length === 0) return 0

  let notified = 0
  for (const telegramId of telegramIds) {
    try {
      await sendTelegramMessage(BOT_TOKEN, telegramId, text, 'Markdown', appKeyboard())
      notified++
    } catch (error) {
      console.error('broadcastCustomMessage error:', error)
    }
  }
  return notified
}
