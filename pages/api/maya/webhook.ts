import { NextApiRequest, NextApiResponse } from 'next'
import { verifyTributeSignature, TRIBUTE_EVENTS } from '@/lib/tribute'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

const MAYA_BOT_TOKEN = process.env.MAYA_BOT_TOKEN || ''

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

    // Verify Tribute signature
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
    const payload = body
    await supabase.from('events').insert({
      source: 'maya_tribute',
      event_type: payload.event_type,
      payload: body,
    })

    // Handle purchase
    if (payload.event_type === TRIBUTE_EVENTS.PURCHASE_SUCCESS || 
        payload.event_type === TRIBUTE_EVENTS.SUBSCRIPTION_STARTED) {
      const userId = payload.data.user_id
      const productType = payload.data.product_type || 'maya_premium'

      // Create entitlement
      await supabase.from('entitlements').insert({
        telegram_user_id: userId,
        product_type: productType,
        status: 'active',
      })

      // Send delivery message
      const deliveryMessage = `✨ **Welcome to Maya's Private Album**

Thank you for your support. You now have access to premium photo sets.

📸 Latest pack: [Link to your storage/delivery system]

🔔 New packs are added 2-3 times per month.

Enjoy the journey.`

      await sendTelegramMessage(
        MAYA_BOT_TOKEN,
        userId,
        deliveryMessage
      )
    }

    // Handle refund
    if (payload.event_type === TRIBUTE_EVENTS.REFUND) {
      const userId = payload.data.user_id
      await supabase
        .from('entitlements')
        .update({ status: 'revoked' })
        .eq('telegram_user_id', userId)
        .eq('product_type', 'maya_premium')
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Maya webhook error:', error)
    return res.status(200).json({ received: true })
  }
}
