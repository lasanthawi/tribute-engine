import { NextApiRequest, NextApiResponse } from 'next'
import { TelegramUpdate, sendTelegramMessage } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'

const TRIBUTE_CHANNEL_URL = process.env.TRIBUTE_CHANNEL_URL || 'https://tribute.to/your-channel'
const TRIBUTE_BLUEPRINT_URL = process.env.TRIBUTE_BLUEPRINT_URL || 'https://tribute.to/blueprint'
const TRIBUTE_TOOLS_URL = process.env.TRIBUTE_TOOLS_URL || 'https://tribute.to/tools'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const update = req.body as TelegramUpdate

    // Store or update user
    if (update.message?.from) {
      const userId = update.message.from.id
      const username = update.message.from.username || ''

      await supabase.from('users').upsert({
        telegram_user_id: userId.toString(),
        telegram_username: username,
      })

      // Handle /start command
      if (update.message.text === '/start') {
        await handleStart(userId)
      }
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Telegram handler error:', error)
    return res.status(200).json({ ok: true })
  }
}

async function handleStart(userId: number) {
  const messageText = `🚀 **Welcome to AI Automation Intelligence**

Choose what you want:

1️⃣ **Daily AI Automation Channel** - Subscribe to daily drops of tools, workflows, prompts, and monetizable ideas.

2️⃣ **Automation Blueprint Generator** - Answer quick questions and get a tailored blueprint PDF + prompts for your business.

3️⃣ **Private Tools Bot Access** - Access our AI bot that generates posts, funnels, scripts, and plans on demand.

What interests you?`

  await sendTelegramMessage(
    process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
    userId,
    messageText
  )
}
