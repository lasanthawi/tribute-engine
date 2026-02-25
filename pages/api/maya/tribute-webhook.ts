import { NextApiRequest, NextApiResponse } from 'next'
import { verifyTributeSignature, TRIBUTE_EVENTS, TributeWebhookPayload } from '@/lib/tribute'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const signature = req.headers['trbt-signature'] as string
    const body = req.body

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' })
    }

    // Verify signature
    const rawBody = JSON.stringify(body)
    const isValid = verifyTributeSignature(
      Buffer.from(rawBody),
      signature,
      process.env.MAYA_TRIBUTE_API_KEY || process.env.TRIBUTE_API_KEY!
    )

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Store event
    const payload = body as TributeWebhookPayload
    await supabase.from('maya_purchases').insert({
      user_id: payload.data.user_id,
      product_id: payload.data.product_id,
      event_type: payload.event_type,
      amount: payload.data.amount,
      payload: body,
    })

    // Route by event type
    switch (payload.event_type) {
      case TRIBUTE_EVENTS.PURCHASE_SUCCESS:
      case TRIBUTE_EVENTS.SUBSCRIPTION_STARTED:
        await handleMayaPurchase(payload)
        break
      case TRIBUTE_EVENTS.REFUND:
        await handleMayaRefund(payload)
        break
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Maya webhook error:', error)
    return res.status(200).json({ received: true })
  }
}

async function handleMayaPurchase(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id
  const productType = payload.data.product_type || 'photo_pack'

  // Create access record
  await supabase.from('maya_access').insert({
    telegram_user_id: userId,
    product_type: productType,
    status: 'active',
  })

  // Send delivery message
  const message = `✅ **Purchase Confirmed!**

Thank you for supporting my travels! 🌍

Your premium content is ready:

📸 **What you get:**
${productType === 'subscription' ? '• Access to all new photo packs\n• 2-3 exclusive collections per month\n• High-resolution downloads' : '• 15-25 curated photos\n• High-resolution files\n• Instant download'}

👉 Access your content here: [Premium Album Link]

New content is added regularly. Enjoy! ✨

- Maya`

  await sendTelegramMessage(
    process.env.MAYA_BOT_TOKEN!,
    userId,
    message
  )

  // Notify ops
  await sendTelegramMessage(
    process.env.TELEGRAM_OPS_BOT_TOKEN!,
    process.env.OPS_CHAT_ID || 'admin',
    `💰 Maya purchase: ${userId} bought ${productType}`
  )
}

async function handleMayaRefund(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id

  await supabase
    .from('maya_access')
    .update({ status: 'revoked' })
    .eq('telegram_user_id', userId)
}
