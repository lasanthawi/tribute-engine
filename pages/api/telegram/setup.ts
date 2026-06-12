import { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_API_BASE = 'https://api.telegram.org'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const action = req.query.action === 'set' ? 'set' : 'info'

  try {
    if (action === 'set') {
      const webhookUrl = `${process.env.MINI_APP_URL}/api/telegram/webhook`
      const response = await axios.post(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/setWebhook`, {
        url: webhookUrl,
      })
      return res.status(200).json(response.data)
    }

    const response = await axios.get(`${TELEGRAM_API_BASE}/bot${BOT_TOKEN}/getWebhookInfo`)
    res.status(200).json(response.data)
  } catch (error: any) {
    console.error('telegram/setup error:', error?.response?.data ?? error)
    res.status(500).json({ error: error?.response?.data ?? 'Internal error' })
  }
}
