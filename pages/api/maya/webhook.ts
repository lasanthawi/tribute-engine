import { NextApiRequest, NextApiResponse } from 'next'
import { verifyTributeSignature, TRIBUTE_EVENTS } from '@/lib/tribute'
import { supabase } from '@/lib/supabase'
import axios from 'axios'

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
    const payload = body
    await supabase.from('events').insert({
      source: 'tribute_maya',
      event_type: payload.event_type,
      payload: body,
    })

    // Handle purchase
    if (
      payload.event_type === TRIBUTE_EVENTS.PURCHASE_SUCCESS ||
      payload.event_type === TRIBUTE_EVENTS.SUBSCRIPTION_STARTED
    ) {
      await handleMayaPurchase(payload)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Maya webhook error:', error)
    return res.status(200).json({ received: true })
  }
}

async function handleMayaPurchase(payload: any) {
  const userId = payload.data.user_id
  const productId = payload.data.product_id

  // Create entitlement
  await supabase.from('maya_purchases').insert({
    telegram_user_id: userId,
    product_id: productId,
    pack_id: null, // Will be set when pack is assigned
    status: 'pending',
  })

  // Get latest available pack
  const { data: pack } = await supabase
    .from('maya_photo_packs')
    .select('id, theme')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!pack) {
    console.error('No available photo packs')
    return
  }

  // Get pack photos
  const { data: photos } = await supabase
    .from('maya_photos')
    .select('image_url')
    .eq('pack_id', pack.id)
    .order('order_index')

  if (!photos || photos.length === 0) {
    console.error('No photos in pack')
    return
  }

  // Send delivery message
  const message = `✨ Thank you for your purchase!\n\n📸 Your premium photo pack "${pack.theme}" is ready.\n\nYou'll receive ${photos.length} high-quality travel photos.\n\nFirst photo arriving now...`

  await axios.post(
    `https://api.telegram.org/bot${MAYA_BOT_TOKEN}/sendMessage`,
    {
      chat_id: userId,
      text: message,
      parse_mode: 'Markdown',
    }
  )

  // Send photos
  for (const photo of photos.slice(0, 5)) {
    // Send first 5 immediately
    await axios.post(
      `https://api.telegram.org/bot${MAYA_BOT_TOKEN}/sendPhoto`,
      {
        chat_id: userId,
        photo: photo.image_url,
      }
    )
  }

  // Update purchase status
  await supabase
    .from('maya_purchases')
    .update({ status: 'delivered', pack_id: pack.id })
    .eq('telegram_user_id', userId)
    .eq('product_id', productId)

  // Notify ops
  await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_OPS_BOT_TOKEN}/sendMessage`,
    {
      chat_id: process.env.OPS_CHAT_ID,
      text: `✅ Maya pack delivered to user ${userId}\nPack: ${pack.theme}`,
    }
  )
}
