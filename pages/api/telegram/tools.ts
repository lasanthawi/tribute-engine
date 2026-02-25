import { NextApiRequest, NextApiResponse } from 'next'
import { TelegramUpdate, sendTelegramMessage } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'
import { generateToolOutput } from '@/lib/openai'
import { setRateLimit } from '@/lib/redis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const update = req.body as TelegramUpdate

    if (!update.message?.from) {
      return res.status(200).json({ ok: true })
    }

    const userId = update.message.from.id.toString()
    const text = update.message.text || ''

    // Check entitlement
    const { data: entitlements, error: entitlementError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('telegram_user_id', userId)
      .eq('product_type', 'tools_access')
      .eq('status', 'active')

    if (entitlementError || !entitlements || entitlements.length === 0) {
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `You need to activate the Tools Bot. Click here: ${process.env.TRIBUTE_TOOLS_URL}`
      )
      return res.status(200).json({ ok: true })
    }

    // Rate limit
    const allowed = await setRateLimit(userId, 10, 60) // 10 requests per minute
    if (!allowed) {
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        'Rate limit exceeded. Try again in a moment.'
      )
      return res.status(200).json({ ok: true })
    }

    // Parse commands
    if (text.startsWith('/post')) {
      const output = await generateToolOutput('/post', 'Generate a viral Telegram post')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `📝 **Generated Post:**\n\n${output}`
      )
    } else if (text.startsWith('/funnel')) {
      const output = await generateToolOutput('/funnel', 'Generate a sales funnel')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `🔗 **Funnel:**\n\n${output}`
      )
    } else if (text.startsWith('/script')) {
      const output = await generateToolOutput('/script', 'Generate a bot/sales script')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `💬 **Script:**\n\n${output}`
      )
    } else if (text.startsWith('/ideas')) {
      const output = await generateToolOutput('/ideas', 'Generate 20 monetizable ideas')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `💡 **Ideas:**\n\n${output}`
      )
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Tools handler error:', error)
    return res.status(200).json({ ok: true })
  }
}
