import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateBlueprint(
  niche: string,
  offerType: string,
  audience: string,
  trafficSource: string,
  goal: string
): Promise<string> {
  const prompt = `Generate a detailed automation blueprint for the following:
  
Niche: ${niche}
Offer Type: ${offerType}
Audience: ${audience}
Current Traffic Source: ${trafficSource}
Goal: ${goal}

Provide:
1. 7-Day Content Plan
2. Funnel Steps
3. Automation Workflow
4. Scripts and Prompts
5. Recommended Telegram Channel Structure

Format as clear, actionable steps.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (content) {
    return content
  }
  
  throw new Error('Unexpected response format from OpenAI')
}

export async function generateToolOutput(command: string, context: string): Promise<string> {
  const prompt = `Based on this command: ${command}
  
Context: ${context}

Generate creative, actionable output suitable for use in Telegram. Keep it concise and practical.`

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (content) {
    return content
  }
  
  throw new Error('Unexpected response format from OpenAI')
}

// Maya Travel Influencer Content Generation
export async function generateTravelCaption(
  location: string,
  mood: string,
  imageDescription: string
): Promise<string> {
  const prompt = `You are Maya Elara, a 25-year-old solo traveler sharing thoughtful moments from your journey.

Location: ${location}
Mood: ${mood}
Image context: ${imageDescription}

Write a short, authentic caption (40-70 words) that:
- Feels personal but not oversharing
- Is reflective and calm
- Mentions the place subtly
- Uses simple, natural language
- No emojis, no hashtags
- First person perspective

Example tone: "The morning light here is different. Softer. I found this café by accident, tucked between old buildings. Coffee tastes better when you're not rushing."

Write the caption:`

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    max_tokens: 150,
    temperature: 0.8,
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

export async function generateImagePrompt(
  location: string,
  setting: string,
  timeOfDay: string
): Promise<string> {
  const baseCharacter = `Maya Elara, 25-year-old woman, natural Mediterranean features, shoulder-length wavy brown hair, warm brown eyes, casual travel style, authentic candid moment`
  
  const prompt = `${baseCharacter}, ${setting} in ${location}, ${timeOfDay} natural lighting, soft cinematic photography, travel documentary style, realistic, unposed, genuine moment, professional travel photography aesthetic, shot on 35mm, natural colors, shallow depth of field`
  
  return prompt
}
