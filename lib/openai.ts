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

  const message = await openai.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const textContent = message.content[0]
  if (textContent.type === 'text') {
    return textContent.text
  }
  
  throw new Error('Unexpected response format from OpenAI')
}

export async function generateToolOutput(command: string, context: string): Promise<string> {
  const prompt = `Based on this command: ${command}
  
Context: ${context}

Generate creative, actionable output suitable for use in Telegram.`

  const message = await openai.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const textContent = message.content[0]
  if (textContent.type === 'text') {
    return textContent.text
  }
  
  throw new Error('Unexpected response format from OpenAI')
}
