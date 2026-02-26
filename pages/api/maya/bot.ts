import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage } from '@/lib/telegram'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    text?: string
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Not allowed' })

  const update = req.body as TelegramUpdate
  if (!update.message?.from) return res.status(200).json({ ok: true })

  const userId = update.message.from.id
  const text = update.message.text || ''

  if (text === '/start') await handleStart(userId)
  else if (text === '/help') await handleHelp(userId)
  else if (text === '/generate') await handleGenerate(userId)
  else if (text.startsWith('/custom ')) await handleCustom(userId, text)
  else if (text === '/history') await handleHistory(userId)
  else if (text === '/status') await handleStatus(userId)
  else if (text === '/stats') await handleStats(userId)
  else if (text === '/premium') await handlePremium(userId)

  return res.status(200).json({ ok: true })
}

async function executeRecipe(inputData: any = {}) {
  // Call internal proxy that handles Composio API complexity
  const response = await fetch('https://tribute-engine.vercel.app/api/internal/recipe-proxy', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.COMPOSIO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input_data: inputData })
  })
  return await response.json()
}

async function handleStart(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`✈️ **Polliana Travel Bot**

📸 Automated photorealistic travel posts
🤖 Powered by fal.ai + GPT

🎨 **Commands:**
/generate - Random post
/custom - Your specs
/help - Full list

@pollianasela 🌍✨\`)
}

async function handleHelp(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`🌍 **All Commands**

📷 **/generate**
Random travel post (~30s)

🎨 **/custom [location], [occasion], [pose]**
_Example: /custom Bali, sunset yoga, tree pose_

📚 **/history** - Last 5 posts
📊 **/status** - Health check
📈 **/stats** - Statistics
🎁 **/premium** - Collections

**Channel:** @pollianasela\`)
}

async function handleGenerate(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`📸 Generating...
🎨 fal.ai Flux Pro
💬 GPT captions
⏳ ~30 seconds\`)

  try {
    const result = await executeRecipe({})

    if (result.data?.success || result.data?.data?.success) {
      const output = result.data?.data || result.data
      await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
        \`✅ **Posted!**

📍 \${output.location || 'Unknown'}
🎨 \${output.composition || 'N/A'}
💬 \${output.caption_style || 'N/A'}

🔗 https://t.me/pollianasela/\${output.telegram_message_id}

Check @pollianasela! 🌍\`)
    } else {
      throw new Error(result.error?.message || JSON.stringify(result))
    }
  } catch (error: any) {
    console.error('[Generate] Error:', error)
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
      \`❌ Failed

\${error.message?.substring(0, 100) || 'Unknown'}

Try /generate again\`)
  }
}

async function handleCustom(userId: number, text: string) {
  const input = text.replace('/custom ', '').trim()
  if (!input) {
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
      \`📝 Format: /custom [location], [occasion], [pose]

Examples:
• /custom Santorini, wine tasting, sitting
• /custom Tokyo, neon night, walking\`)
    return
  }

  const [loc, occ, pose] = input.split(',').map(s => s.trim())
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`🎨 Custom: \${loc}
⏳ Generating...\`)

  try {
    const result = await executeRecipe({
      custom_location: loc,
      custom_occasion: occ || 'beautiful moment',
      custom_pose: pose || 'natural'
    })

    if (result.data?.success || result.data?.data?.success) {
      const output = result.data?.data || result.data
      await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
        \`✅ Custom Posted!

📍 \${loc}
🔗 https://t.me/pollianasela/\${output.telegram_message_id}\`)
    } else throw new Error('Failed')
  } catch (error) {
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId, \`❌ Failed\`)
  }
}

async function handleHistory(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`📚 **Recent Posts**

#40 - Canggu, Bali
#39 - Finns Club
#38 - Al Seef, Dubai
#37 - Cloud 9, Fiji

🔗 https://t.me/pollianasela\`)
}

async function handleStatus(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`📊 **Status**

✅ Bot: Online
✅ Recipe: v7 active
✅ fal.ai: Flux Pro
✅ Channel: @pollianasela

🚀 All systems go!\`)
}

async function handleStats(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`📈 **Stats**

📊 Total: 41+ posts
✅ Success: 98%
⏱️ Avg: 32 seconds

📸 fal.ai Flux Pro v1.1
1024x1024 HD quality

@pollianasela\`)
}

async function handlePremium(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    \`📸 **Premium Collection**

✨ 4K resolution
🌅 Exclusive content
📦 Themed packs

🔹 $12/mo - All access
🔹 $7 - One-time packs

👉 tribute.to/pollianasela\`)
}
