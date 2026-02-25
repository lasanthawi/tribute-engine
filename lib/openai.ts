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
