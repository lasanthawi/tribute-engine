import { NextApiRequest, NextApiResponse } from 'next'
import type { NextApiHandler } from 'next'

// This endpoint exists so the bot can trigger recipe execution
// It returns immediately and the recipe runs async

const handler: NextApiHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { input_data = {} } = req.body

  // Return immediately - recipe will execute and post to channel
  res.status(202).json({ 
    status: 'accepted',
    message: 'Recipe execution triggered',
    recipe_id: 'rcp_xTlvCq1gSt4p',
    note: 'Check @pollianasela channel in ~30 seconds'
  })

  // Execute async (non-blocking)
  executeRecipeAsync(input_data).catch(err => {
    console.error('[Recipe Proxy] Error:', err)
  })
}

async function executeRecipeAsync(inputData: any) {
  try {
    // Call Composio execute action
    const response = await fetch('https://backend.composio.dev/api/v3/actions/COMPOSIO_EXECUTE_RECIPE/execute', {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.COMPOSIO_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          recipe_id: 'rcp_xTlvCq1gSt4p',
          input_data: inputData
        }
      }),
      signal: AbortSignal.timeout(180000)
    })

    const result = await response.json()
    console.log('[Recipe Proxy] Result:', JSON.stringify(result).substring(0, 200))
    return result
  } catch (error) {
    console.error('[Recipe Proxy] Async error:', error)
    throw error
  }
}

export default handler
export const config = {
  maxDuration: 300,
}
