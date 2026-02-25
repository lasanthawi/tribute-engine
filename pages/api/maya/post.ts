import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramPhoto } from '@/lib/telegram'

const MAYA_BOT_TOKEN = process.env.MAYA_BOT_TOKEN || ''
const MAYA_CHANNEL_ID = process.env.MAYA_CHANNEL_ID || '@pollianasela'
const TRIBUTE_PREMIUM_URL = process.env.MAYA_TRIBUTE_URL || 'https://tribute.to/your-maya-product'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify cron job authentication
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { imageUrl, caption, includeButton } = req.body

    if (!imageUrl || !caption) {
      return res.status(400).json({ error: 'Missing imageUrl or caption' })
    }

    // Optional inline button for premium access
    const replyMarkup = includeButton ? {
      inline_keyboard: [[
        {
          text: '🔒 View Private Album',
          url: TRIBUTE_PREMIUM_URL
        }
      ]]
    } : undefined

    // Post to channel
    await sendTelegramPhoto(
      MAYA_BOT_TOKEN,
      MAYA_CHANNEL_ID,
      imageUrl,
      caption,
      replyMarkup
    )

    return res.status(200).json({ success: true, posted: true })
  } catch (error: any) {
    console.error('Post error:', error)
    return res.status(500).json({ error: error.message })
  }
}
