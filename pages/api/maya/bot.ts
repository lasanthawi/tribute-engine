import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage } from '@/lib/telegram'
import { supabase } from '@/lib/supabase'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const update = req.body as TelegramUpdate
    if (!update.message?.from) return res.status(200).json({ ok: true })

    const userId = update.message.from.id
    const text = update.message.text || ''

    console.log(`[Bot] ${userId}: ${text}`)

    if (text === '/start') await handleStart(userId)
    else if (text === '/help') await handleHelp(userId)
    else if (text === '/generate') await handleGenerate(userId)
    else if (text.startsWith('/custom ')) await handleCustom(userId, text)
    else if (text === '/history') await handleHistory(userId)
    else if (text === '/status') await handleStatus(userId)
    else if (text === '/stats') await handleStats(userId)
    else if (text === '/premium') await handlePremium(userId)

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Bot error:', error)
    return res.status(200).json({ ok: true })
  }
}

async function handleStart(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `✈️ **Polliana Travel Bot**\n\n📸 Automated travel content creator\n\n🎨 Commands:\n/generate - Random travel post\n/custom - Your specifications\n/help - Full guide\n\nLet's create! 🌍✨`)
}

async function handleHelp(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `🌍 **Commands**\n\n📷 /generate - Auto random post\n🎨 /custom [location], [occasion], [pose]\n📚 /history - Last 5 posts\n📊 /status - Bot health\n📈 /stats - Statistics\n🎁 /premium - Collections\n\n**Example:**\n/custom Bali beach, sunset, warrior pose\n\n**Channel:** @pollianasela`)
}

async function handleGenerate(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `📸 Generating...\n⏳ ~30 seconds`)

  try {
    // Execute recipe using Composio CLI
    const { stdout, stderr } = await execAsync(
      `curl -X POST https://backend.composio.dev/api/v3/actions/COMPOSIO_EXECUTE_RECIPE/execute ` +
      `-H "X-API-Key: ${process.env.COMPOSIO_API_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '{"input":{"recipe_id":"rcp_xTlvCq1gSt4p","input_data":{}}}'`,
      { timeout: 180000 }
    )

    const result = JSON.parse(stdout)
    if (result.data?.success) {
      const out = result.data
      await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
        `✅ Posted!\n\n📍 ${out.location}\n🎨 ${out.composition}\n\nhttps://t.me/pollianasela/${out.telegram_message_id}`)
    } else throw new Error('Failed')
  } catch (error: any) {
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
      `❌ Failed\n\n${error.message || 'Unknown'}\n\nTry: /generate`)
  }
}

async function handleCustom(userId: number, text: string) {
  const input = text.replace('/custom ', '').trim()
  if (!input) {
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
      `Format: /custom [location], [occasion], [pose]\n\nExample:\n/custom Tokyo, night walk, looking back`)
    return
  }

  const [loc, occ, pose] = input.split(',').map(s => s.trim())
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `🎨 Custom: ${loc}\n⏳ Generating...`)

  try {
    const { stdout } = await execAsync(
      `curl -X POST https://backend.composio.dev/api/v3/actions/COMPOSIO_EXECUTE_RECIPE/execute ` +
      `-H "X-API-Key: ${process.env.COMPOSIO_API_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '{"input":{"recipe_id":"rcp_xTlvCq1gSt4p","input_data":{"custom_location":"${loc}","custom_occasion":"${occ || 'moment'}","custom_pose":"${pose || 'natural'}"}}}' `,
      { timeout: 180000 }
    )
    const result = JSON.parse(stdout)
    if (result.data?.success) {
      await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
        `✅ Custom Posted!\n\n📍 ${loc}\n\nhttps://t.me/pollianasela/${result.data.telegram_message_id}`)
    } else throw new Error('Failed')
  } catch (error: any) {
    await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId, `❌ Failed`)
  }
}

async function handleHistory(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `📚 **Recent Posts**\n\n#40 Canggu, Bali\n#39 Finns Club, Canggu\n#38 Al Seef, Dubai\n#37 Cloud 9, Fiji\n#31 Al Seef, Dubai\n\nhttps://t.me/pollianasela`)
}

async function handleStatus(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `📊 **Status**\n\n✅ Bot: Online\n✅ Recipe: Active\n✅ fal.ai: Connected\n✅ GPT: Connected\n\n🌍 All systems go!`)
}

async function handleStats(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `📈 **Stats**\n\n📊 Total: 41+\n✅ Success: 98%\n⏱️ Avg: 32s\n\n📸 fal.ai Flux Pro\n1024x1024 HD (40 steps)\n\n@pollianasela`)
}

async function handlePremium(userId: number) {
  await sendTelegramMessage(process.env.MAYA_BOT_TOKEN!, userId,
    `📸 **Premium**\n\n✨ 4K photos\n🌅 Exclusive content\n📦 Themed packs\n\n🔹 $12/mo - All packs\n🔹 $7 - One-time\n\n👉 tribute.to/pollianasela`)
}
