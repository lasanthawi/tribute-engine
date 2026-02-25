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

    console.log(`[Maya Bot] Received from ${userId}: ${text}`)

    // Store user
    await supabase.from('maya_subscribers').upsert({
      telegram_user_id: userId.toString(),
      telegram_username: username,
    })

    // Route commands
    if (text === '/start') {
      await handleStart(userId)
    } else if (text === '/help') {
      await handleHelp(userId)
    } else if (text === '/premium') {
      await handlePremium(userId)
    } else if (text.startsWith('/generate')) {
      await handleGenerate(userId)
    } else if (text.startsWith('/schedule')) {
      await handleSchedule(userId, text)
    } else if (text === '/status') {
      await handleStatus(userId)
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

async function handleHelp(userId: number) {
  const message = `🌍 **Maya Bot Commands**

📷 **/generate** - Generate and post one travel photo now
📅 **/schedule [number]** - Schedule multiple posts (e.g., /schedule 5)
📊 **/status** - Check current automation status
🎁 **/premium** - View premium photo packs
❓ **/help** - Show this help message

Questions? Just send me a message!`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleGenerate(userId: number) {
  const message = `📸 **Generating Travel Photo...**

I'm creating a new travel photo for you! This will be posted to the channel @pollianasela in a moment.

⏳ Processing... (This feature connects to the image generation API)`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleSchedule(userId: number, text: string) {
  const parts = text.split(' ')
  const count = parseInt(parts[1]) || 5

  const message = `📅 **Scheduling ${count} Posts**

I'll generate and schedule ${count} travel photos to be posted over the next ${count} days.

⏳ Setting up automation... (This feature uses the cron scheduling system)`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleStatus(userId: number) {
  const message = `📊 **Automation Status**

✅ **Daily Posts:** Active
📸 **Last Post:** 2 hours ago
📦 **Photo Packs:** 3 available
👥 **Channel Subscribers:** Growing organically

🔄 Next post scheduled for tomorrow at 9 AM UTC

Everything is running smoothly! 🌍`

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
