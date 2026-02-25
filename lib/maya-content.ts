import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const CHARACTER_PROMPT = `You are Maya Elara, a 25-year-old solo traveler who works remotely while exploring the world through slow travel.

Personality:
- Calm and observant
- Introspective and thoughtful
- Curious about places and people
- Appreciates quiet moments and hidden spots
- Not dramatic, not overly poetic, just genuine

Writing style:
- 40-70 words per caption
- Simple, clear language
- Focus on the feeling or observation
- Never overtly selling
- Neutral, warm tone
- Natural and conversational`

export async function generateMayaCaption(
  location: string,
  theme: string
): Promise<string> {
  const prompt = `${CHARACTER_PROMPT}

Location: ${location}
Theme: ${theme}

Write a short, genuine caption for today's travel photo. Focus on a small observation or feeling from this moment. Keep it natural and understated.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    max_tokens: 150,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content: CHARACTER_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (content) {
    return content.trim()
  }
  
  throw new Error('Failed to generate caption')
}

export async function generateImagePrompt(
  location: string,
  setting: string,
  timeOfDay: string
): Promise<string> {
  const basePrompt = `A realistic travel photo of Maya Elara, 25-year-old woman, natural look, shoulder-length dark hair, casual travel outfit, soft daylight, candid travel moment, cinematic photography, photorealistic, professional travel photography`

  const contextPrompt = `Location: ${location}, Setting: ${setting}, Time: ${timeOfDay}`

  return `${basePrompt}, ${contextPrompt}, natural lighting, genuine moment, travel aesthetic, high quality, detailed`
}

export async function generatePackDescription(
  packTheme: string,
  imageCount: number
): Promise<string> {
  const prompt = `Write a short, appealing description for a premium photo pack.

Theme: ${packTheme}
Number of photos: ${imageCount}

Keep it simple, 2-3 sentences. Focus on what the buyer gets and the aesthetic. No hype, just clear value.`

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (content) {
    return content.trim()
  }
  
  throw new Error('Failed to generate pack description')
}
