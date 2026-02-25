import { NextApiRequest, NextApiResponse } from 'next'
import { sendTelegramMessage } from '@/lib/telegram'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Content topics for variety
const contentTopics = [
  'AI automation tools and workflows',
  'Telegram bot monetization strategies',
  'OpenAI API integration tips',
  'Passive income automation ideas',
  'No-code automation platforms',
  'AI-powered content generation',
  'SaaS automation workflows',
  'Productivity hacks with AI',
  'Building digital products',
  'Marketing automation techniques'
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify cron secret for security
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Select random topic
    const topic = contentTopics[Math.floor(Math.random() * contentTopics.length)]

    // Generate content using OpenAI
    const prompt = `Create an engaging Telegram channel post about ${topic}.
    
Requirements:
    - 150-200 words
    - Use emojis strategically
    - Include 3-5 actionable bullet points
    - Add relevant hashtags at the end
    - Make it valuable and actionable
    - Format for Telegram markdown
    
Style: Professional but conversational, focus on practical value.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      max_tokens: 500,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: 'You are an expert content creator for automation and AI channels. Create engaging, valuable posts.'
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content generated')
    }

    // Post to public channel
    await sendTelegramMessage(
      process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
      '@builtappsai',
      content,
      'Markdown'
    )

    // Post to paid channel if ID is set
    if (process.env.TELEGRAM_PAID_CHANNEL_ID) {
      // Add premium indicator
      const premiumContent = `🔐 **PREMIUM CONTENT**\n\n${content}\n\n---\n💎 *Exclusive for paid members*`
      
      await sendTelegramMessage(
        process.env.TELEGRAM_PUBLIC_BOT_TOKEN!,
        process.env.TELEGRAM_PAID_CHANNEL_ID,
        premiumContent,
        'Markdown'
      )
    }

    return res.status(200).json({
      success: true,
      topic,
      contentLength: content.length,
      postedTo: process.env.TELEGRAM_PAID_CHANNEL_ID ? 'both channels' : 'public only'
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return res.status(500).json({ error: 'Failed to publish content' })
  }
}
