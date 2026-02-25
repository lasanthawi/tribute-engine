import { NextApiRequest, NextApiResponse } from 'next'
import { generateTravelCaption, generateImagePrompt } from '@/lib/openai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify API key for security
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${process.env.MAYA_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { location, setting, timeOfDay, mood } = req.body

    // Generate image prompt
    const imagePrompt = await generateImagePrompt(
      location || 'Santorini, Greece',
      setting || 'sitting at a seaside café',
      timeOfDay || 'golden hour sunset'
    )

    // Generate caption
    const caption = await generateTravelCaption(
      location || 'Santorini',
      mood || 'peaceful',
      setting || 'café by the sea'
    )

    return res.status(200).json({
      success: true,
      imagePrompt,
      caption,
      note: 'Use imagePrompt with your preferred image generation API (DALL-E, Midjourney, Stable Diffusion)'
    })
  } catch (error: any) {
    console.error('Content generation error:', error)
    return res.status(500).json({ error: error.message })
  }
}
