import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name: string
      username?: string
    }
    chat: {
      id: number
      type: string
    }
    text?: string
  }
}

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
    await supabase.from('maya_subscribers').upsert({
      telegram_user_id: userId.toString(),
      telegram_username: username,
    })

    // Handle /start command
    if (text === '/start') {
      await handleStart(userId)
    }

    // Handle /premium command
    if (text === '/premium') {
      await handlePremium(userId)
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Maya bot error:', error)
    return res.status(200).json({ ok: true })
  }
}

async function handleStart(userId: number) {
  const message = `✈️ **Welcome to Maya's Travel Notes**

Hi! I'm Maya, and I'm sharing my journey through slow travel, quiet places, and moments worth remembering.

📸 Every day, I post one photo and a reflection from wherever I am in the world.

🎁 **Want more?**
My premium photo collections include unseen angles, higher resolution images, and curated sets from my travels.

👉 Check out my premium albums below.

Thank you for being here. 🌍`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handlePremium(userId: number) {
  const tributeUrl = process.env.MAYA_TRIBUTE_URL || 'https://tribute.to/your-maya-products'
  
  const message = `📸 **Maya's Private Album**

Get access to my exclusive photo collections:

✨ High-resolution travel photos
🌅 Unseen angles and moments
🎨 Themed sets (cities, beaches, cafes, sunsets)
📦 2-3 new packs every month

**Premium Packs Available:**

🔹 Monthly Subscription - $12/month
   • All new photo packs
   • Early access to content
   • Behind-the-scenes shots

🔹 One-Time Packs - $7 each
   • Themed collections
   • 15-25 curated photos
   • Instant delivery

👉 [View Premium Albums](${tributeUrl})`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}
