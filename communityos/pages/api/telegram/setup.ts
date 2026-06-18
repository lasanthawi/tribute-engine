import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { getTelegramWebhookInfo, setTelegramCommands, setTelegramMenuButton, setTelegramWebhook } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (rejectUnauthorizedCron(req, res)) return

  const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
  const miniAppUrl = process.env.MINI_APP_URL || ''
  const webhookTarget = process.env.TELEGRAM_WEBHOOK_URL || miniAppUrl
  const webhookUrl = webhookTarget
    ? webhookTarget.endsWith('/api/telegram/webhook')
      ? webhookTarget
      : `${webhookTarget.replace(/\/$/, '')}/api/telegram/webhook`
    : ''

  if (!botToken || !miniAppUrl || !webhookUrl) {
    return res.status(400).json({
      error: 'Missing TELEGRAM_BOT_TOKEN, MINI_APP_URL, or TELEGRAM_WEBHOOK_URL.',
    })
  }

  try {
    await setTelegramWebhook(botToken, webhookUrl, process.env.TELEGRAM_WEBHOOK_SECRET)
    await setTelegramMenuButton(botToken, miniAppUrl)
    await setTelegramCommands(botToken)
    const webhookInfo = await getTelegramWebhookInfo(botToken)
    res.status(200).json({ ok: true, webhookUrl, miniAppUrl, webhookInfo })
  } catch (error: any) {
    console.error('telegram/setup error:', error)
    res.status(500).json({ error: error.message || 'Telegram setup failed' })
  }
}
