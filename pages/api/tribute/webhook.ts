import { NextApiRequest, NextApiResponse } from 'next'
import { verifyTributeSignature, TRIBUTE_EVENTS, TributeWebhookPayload } from '@/lib/tribute'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { storeQueue } from '@/lib/redis'

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
      process.env.TRIBUTE_API_KEY!
    )

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Store event
    const payload = body as TributeWebhookPayload
    await supabase.from('events').insert({
      source: 'tribute',
      event_type: payload.event_type,
      payload: body,
    })

    // Route by event type
    switch (payload.event_type) {
      case TRIBUTE_EVENTS.PURCHASE_SUCCESS:
      case TRIBUTE_EVENTS.SUBSCRIPTION_STARTED:
        await handlePurchase(payload)
        break
      case TRIBUTE_EVENTS.SUBSCRIPTION_RENEWED:
        await handleRenewal(payload)
        break
      case TRIBUTE_EVENTS.REFUND:
        await handleRefund(payload)
        break
      case TRIBUTE_EVENTS.SUBSCRIPTION_CANCELED:
        await handleCancel(payload)
        break
    }

    // Always return 200 quickly
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return res.status(200).json({ received: true }) // Still return 200 for retry logic
  }
}

async function handlePurchase(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id
  const productType = payload.data.product_type || 'digital_product'

  // Create entitlement
  await supabase.from('entitlements').insert({
    telegram_user_id: userId,
    product_type: productType,
    status: 'active',
  })

  // Create delivery record
  if (productType === 'digital_product') {
    await storeQueue('blueprint_generation', {
      telegram_user_id: userId,
      product_id: payload.data.product_id,
    })
  }

  // Notify ops bot
  await sendTelegramMessage(
    process.env.TELEGRAM_OPS_BOT_TOKEN!,
    process.env.OPS_CHAT_ID!,
    `✅ New purchase from user ${userId}\nProduct: ${productType}`
  )
}

async function handleRenewal(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id

  await supabase
    .from('entitlements')
    .update({ status: 'active' })
    .eq('telegram_user_id', userId)
}

async function handleRefund(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id

  await supabase
    .from('entitlements')
    .update({ status: 'revoked' })
    .eq('telegram_user_id', userId)

  await sendTelegramMessage(
    process.env.TELEGRAM_OPS_BOT_TOKEN!,
    process.env.OPS_CHAT_ID!,
    `❌ Refund for user ${userId}`
  )
}

async function handleCancel(payload: TributeWebhookPayload) {
  const userId = payload.data.user_id

  await supabase
    .from('entitlements')
    .update({ status: 'revoked' })
    .eq('telegram_user_id', userId)
}
