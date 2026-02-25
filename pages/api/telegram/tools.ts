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
        `📝 **Generated Post:**\\n\\n${output}`
      )
    } else if (text.startsWith('/funnel')) {
      const output = await generateToolOutput('/funnel', 'Generate a sales funnel')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `🔗 **Funnel:**\\n\\n${output}`
      )
    } else if (text.startsWith('/script')) {
      const output = await generateToolOutput('/script', 'Generate a bot/sales script')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `💬 **Script:**\\n\\n${output}`
      )
    } else if (text.startsWith('/ideas')) {
      const output = await generateToolOutput('/ideas', 'Generate 20 monetizable ideas')
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        userId,
        `💡 **Ideas:**\\n\\n${output}`
      )
    } else if (text.startsWith('/generate')) {
      // Execute Polliana Daily Travel Post recipe
      try {
        const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY
        
        if (!COMPOSIO_API_KEY) {
          await sendTelegramMessage(
            process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
            userId,
            `⚠️ Configuration error: Composio API key not set. Please contact admin.`
          )
          return res.status(200).json({ ok: true })
        }

        // Notify user that generation started
        await sendTelegramMessage(
          process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
          userId,
          `🎨 Generating travel post... This may take 30-60 seconds.`
        )

        const composioResponse = await fetch('https://backend.composio.dev/api/v1/recipe/rcp_xTlvCq1gSt4p/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': COMPOSIO_API_KEY
          },
          body: JSON.stringify({
            input: {}
          })
        })
        
        if (!composioResponse.ok) {
          const errorText = await composioResponse.text()
          console.error('Composio API error:', composioResponse.status, errorText)
          
          await sendTelegramMessage(
            process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
            userId,
            `❌ **Generation Failed**\\n\\nAPI Error: ${composioResponse.status}\\n${errorText.substring(0, 200)}`
          )
          return res.status(200).json({ ok: true })
        }
        
        const result = await composioResponse.json()
        console.log('Recipe result:', JSON.stringify(result, null, 2))
        
        if (result.data?.data?.success) {
          const data = result.data.data
          await sendTelegramMessage(
            process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
            userId,
            `✅ **Travel Post Generated!**\\n\\n📍 Location: ${data.location}\\n📸 Composition: ${data.composition}\\n🎥 Camera: ${data.camera_settings}\\n\\n✨ Posted to @pollianasela (msg #${data.telegram_message_id})\\n\\n[View Post](https://t.me/pollianasela/${data.telegram_message_id})`
          )
        } else {
          const errorMsg = result.error || result.data?.error || 'Unknown error'
          console.error('Recipe failed:', errorMsg)
          
          await sendTelegramMessage(
            process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
            userId,
            `❌ Recipe execution failed: ${errorMsg}`
          )
        }
      } catch (error: any) {
        console.error('Recipe execution error:', error)
        await sendTelegramMessage(
          process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
          userId,
          `❌ **Error**: ${error.message || 'Something went wrong'}\\n\\nPlease try again or contact support.`
        )
      }
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Tools handler error:', error)
    return res.status(200).json({ ok: true })
  }
}
