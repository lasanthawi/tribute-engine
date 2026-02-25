import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Master character prompt for consistency
const MAYA_CHARACTER_PROMPT = `A realistic travel photo of Maya Elara, 25-year-old woman, natural look, soft daylight, candid travel moment, cinematic photography, consistent facial features (oval face, warm brown eyes, natural smile, shoulder-length wavy brown hair), casual travel outfit, professional photography, natural lighting, travel setting`

export async function generateMayaImage(
  location: string,
  setting: string,
  mood: string = 'calm and observant'
): Promise<string> {
  const prompt = `${MAYA_CHARACTER_PROMPT}, ${setting} in ${location}, ${mood}, aesthetic travel photography, soft color palette, natural pose`

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
    })

    const imageUrl = response.data[0]?.url
    if (imageUrl) {
      return imageUrl
    }
    throw new Error('No image URL returned')
  } catch (error) {
    console.error('Image generation error:', error)
    throw error
  }
}

export async function generateMayaCaption(
  location: string,
  setting: string,
  mood: string
): Promise<string> {
  const prompt = `Write a short, introspective travel caption (40-70 words) from Maya's perspective. 

Location: ${location}
Setting: ${setting}
Mood: ${mood}

Style: Calm, observant, slightly introspective, curious about places. Not sexualized, not childish. Focus on moments worth remembering.

Example tone: "The morning light here feels different. Softer, somehow. I found this cafe tucked between two old buildings, and I've been here for an hour just watching the city wake up."

Write only the caption, no quotes.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    max_tokens: 150,
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
  
  throw new Error('Failed to generate caption')
}

export async function generatePhotoPack(
  theme: string,
  count: number = 15
): Promise<Array<{ url: string; description: string }>> {
  const photos: Array<{ url: string; description: string }> = []
  
  // Generate themed prompts
  const themePrompts = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: `Generate ${count} specific photo descriptions for a travel photo pack themed "${theme}". Each should be a specific scene/moment. Return as numbered list.`,
      },
    ],
  })

  const descriptions = themePrompts.choices[0]?.message?.content?.split('\n').filter(line => line.trim()) || []

  for (let i = 0; i < Math.min(count, descriptions.length); i++) {
    try {
      const url = await generateMayaImage('various locations', descriptions[i], 'aesthetic')
      photos.push({ url, description: descriptions[i] })
    } catch (error) {
      console.error(`Failed to generate photo ${i + 1}:`, error)
    }
  }

  return photos
}
