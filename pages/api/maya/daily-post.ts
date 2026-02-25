import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { generateMayaImage, generateMayaCaption, generateImagePrompt } from '@/lib/maya-content'
import axios from 'axios'

const MAYA_BOT_TOKEN = process.env.MAYA_BOT_TOKEN || ''
const MAYA_CHANNEL = process.env.MAYA_CHANNEL || '@pollianasela'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify cron secret or API key
    const authHeader = req.headers.authorization
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get random location and setting
    const locations = [
      { name: 'Lisbon', setting: 'cobblestone street cafe' },
      { name: 'Bali', setting: 'rice terrace at sunrise' },
      { name: 'Kyoto', setting: 'traditional temple garden' },
      { name: 'Santorini', setting: 'white buildings by the sea' },
      { name: 'Iceland', setting: 'black sand beach' },
      { name: 'Morocco', setting: 'colorful market alley' },
      { name: 'New Zealand', setting: 'mountain lake view' },
      { name: 'Italy', setting: 'rustic countryside villa' },
    ]

    const random = locations[Math.floor(Math.random() * locations.length)]

    // Generate image
    console.log('Generating image...')
    const imagePrompt = await generateImagePrompt(random.name, random.setting, 'calm and reflective')
    const imageUrl = await generateMayaImage(imagePrompt)

    // Generate caption
    console.log('Generating caption...')
    const caption = await generateMayaCaption(random.name, `${random.setting}, calm and reflective`)

    // Store in database
    const { data: post, error: dbError } = await supabase
      .from('maya_posts')
      .insert({
        image_url: imageUrl,
        caption: caption,
        location: random.name,
        posted: false,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
    }

    // Post to channel
    console.log('Posting to Telegram...')
    const telegramResponse = await axios.post(
      `https://api.telegram.org/bot${MAYA_BOT_TOKEN}/sendPhoto`,
      {
        chat_id: MAYA_CHANNEL,
        photo: imageUrl,
        caption: `${caption}\n\n📍 ${random.name}`,
        parse_mode: 'Markdown',
      }
    )

    // Mark as posted
    if (post) {
      await supabase
        .from('maya_posts')
        .update({ posted: true, posted_at: new Date().toISOString() })
        .eq('id', post.id)
    }

    return res.status(200).json({
      success: true,
      post: {
        location: random.name,
        imageUrl,
        caption,
        telegram: telegramResponse.data,
      },
    })
  } catch (error: any) {
    console.error('Daily post error:', error)
    return res.status(500).json({
      error: 'Failed to create daily post',
      details: error.message,
    })
  }
}
