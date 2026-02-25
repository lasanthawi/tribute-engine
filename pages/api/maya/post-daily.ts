import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram'
import { generateMayaCaption } from '@/lib/maya-content'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify cron secret
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get today's scheduled post
    const { data: post } = await supabase
      .from('maya_content_queue')
      .select('*')
      .eq('status', 'scheduled')
      .eq('post_date', new Date().toISOString().split('T')[0])
      .single()

    if (!post) {
      return res.status(200).json({ message: 'No post scheduled for today' })
    }

    const channelId = process.env.MAYA_CHANNEL_ID!
    const botToken = process.env.MAYA_BOT_TOKEN!

    // Generate caption if not exists
    let caption = post.caption
    if (!caption) {
      caption = await generateMayaCaption(post.location, post.theme)
    }

    // Post to channel
    await sendTelegramPhoto(
      botToken,
      channelId,
      post.image_url,
      caption
    )

    // Update post status
    await supabase
      .from('maya_content_queue')
      .update({ 
        status: 'posted',
        posted_at: new Date().toISOString()
      })
      .eq('id', post.id)

    return res.status(200).json({ success: true, post_id: post.id })
  } catch (error) {
    console.error('Daily post error:', error)
    return res.status(500).json({ error: 'Failed to post' })
  }
}
