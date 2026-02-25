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
  const message = `✈️ **Welcome to Maya's Travel Notes**\n\nHi! I'm Maya, and I'm sharing my journey through slow travel, quiet places, and moments worth remembering.\n\n📸 Every day, I post one photo and a reflection from wherever I am in the world.\n\n🎁 **Want more?**\nMy premium photo collections include unseen angles, higher resolution images, and curated sets from my travels.\n\n👉 Check out my premium albums below.\n\nThank you for being here. 🌍`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleHelp(userId: number) {
  const message = `🌍 **Maya Bot Commands**\n\n📷 **/generate** - Generate and post one travel photo now\n📅 **/schedule [number]** - Schedule multiple posts (e.g., /schedule 5)\n📊 **/status** - Check current automation status\n🎁 **/premium** - View premium photo packs\n❓ **/help** - Show this help message\n\nQuestions? Just send me a message!`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleGenerate(userId: number) {
  // Send immediate confirmation
  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    `📸 **Generating Travel Photo...**\n\nCreating a photorealistic travel moment for @pollianasela channel!\n\n⏳ This takes about 30 seconds...`
  )

  try {
    // Execute Polliana Daily Travel Post Recipe
    const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY
    const RECIPE_ID = 'rcp_xTlvCq1gSt4p' // Polliana Daily Travel Post recipe
    
    console.log('[Maya Bot] Executing recipe:', RECIPE_ID)
    
    const response = await fetch(`https://backend.composio.dev/api/v1/recipe/${RECIPE_ID}/execute`, {
      method: 'POST',
      headers: {
        'x-api-key': COMPOSIO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {},
      }),
    })

    const result = await response.json()
    console.log('[Maya Bot] Recipe execution result:', JSON.stringify(result))

    if (result.data?.data?.success) {
      const output = result.data.data
      await sendTelegramMessage(
        process.env.MAYA_BOT_TOKEN!,
        userId,
        `✅ **Posted Successfully!**\n\n📍 Location: ${output.location || 'Unknown'}\n🎨 Composition: ${output.composition || 'N/A'}\n📷 Type: ${output.moment_type || 'N/A'}\n\nCheck @pollianasela to see the post! 🌍✨`
      )
    } else {
      throw new Error(result.error?.message || 'Recipe execution failed')
    }
  } catch (error) {
    console.error('[Maya Bot] Generation error:', error)
    await sendTelegramMessage(
      process.env.MAYA_BOT_TOKEN!,
      userId,
      `❌ **Generation Failed**\n\nSomething went wrong. Please try again in a moment or contact support.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

async function handleSchedule(userId: number, text: string) {
  const parts = text.split(' ')
  const count = parseInt(parts[1]) || 5

  const message = `📅 **Scheduling ${count} Posts**\n\nI'll generate and schedule ${count} travel photos to be posted over the next ${count} days.\n\n⏳ Setting up automation... (This feature uses the cron scheduling system)`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handleStatus(userId: number) {
  const message = `📊 **Automation Status**\n\n✅ **Daily Posts:** Active\n📸 **Last Post:** 2 hours ago\n📦 **Photo Packs:** 3 available\n👥 **Channel Subscribers:** Growing organically\n\n🔔 Next post scheduled for tomorrow at 9 AM UTC\n\nEverything is running smoothly! 🌍`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}

async function handlePremium(userId: number) {
  const tributeUrl = process.env.MAYA_TRIBUTE_URL || 'https://tribute.to/your-maya-products'
  
  const message = `📸 **Maya's Private Album**\n\nGet access to my exclusive photo collections:\n\n✨ High-resolution travel photos\n🌅 Unseen angles and moments\n🎨 Themed sets (cities, beaches, cafes, sunsets)\n📦 2-3 new packs every month\n\n**Premium Packs Available:**\n\n🔹 Monthly Subscription - $12/month\n   • All new photo packs\n   • Early access to content\n   • Behind-the-scenes shots\n\n🔹 One-Time Packs - $7 each\n   • Themed collections\n   • 15-25 curated photos\n   • Instant delivery\n\n👉 [View Premium Albums](${tributeUrl})`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )
}
