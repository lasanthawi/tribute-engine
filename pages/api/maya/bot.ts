import { NextApiRequest, NextApiResponse } from 'next'
import { TelegramUpdate, sendTelegramMessage } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'

const MAYA_BOT_TOKEN = process.env.MAYA_BOT_TOKEN || ''
const TRIBUTE_PREMIUM_URL = process.env.MAYA_TRIBUTE_URL || 'https://tribute.to/your-maya-product'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const update = req.body as TelegramUpdate

    if (!update.message?.from) {
      return res.status(200).json({ ok: true })
    }

    const userId = update.message.from.id
    const username = update.message.from.username || ''
    const text = update.message.text || ''

    // Store user
    await supabase.from('users').upsert({
      telegram_user_id: userId.toString(),
      telegram_username: username,
    })

    // Handle /start command
    if (text === '/start') {
      const welcomeMessage = `Welcome to Maya's travel notes 🌍

Follow the daily journey on @pollianasela

Some moments stay private. Premium photo sets are available here:
${TRIBUTE_PREMIUM_URL}

No DMs. No chat. Just clean access to exclusive content.`

      await sendTelegramMessage(
        MAYA_BOT_TOKEN,
        userId,
        welcomeMessage
      )
    }

    // Check entitlement for any other messages
    else {
      const { data: entitlement } = await supabase
        .from('entitlements')
        .select('*')
        .eq('telegram_user_id', userId.toString())
        .eq('product_type', 'maya_premium')
        .eq('status', 'active')
        .single()

      if (!entitlement) {
        await sendTelegramMessage(
          MAYA_BOT_TOKEN,
          userId,
          `To access premium content, visit:
${TRIBUTE_PREMIUM_URL}`
        )
      } else {
        await sendTelegramMessage(
          MAYA_BOT_TOKEN,
          userId,
          `You have active access to Maya's Private Album.

Latest packs are delivered automatically.

For support: Use /start`
        )
      }
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Maya bot error:', error)
    return res.status(200).json({ ok: true })
  }
}
