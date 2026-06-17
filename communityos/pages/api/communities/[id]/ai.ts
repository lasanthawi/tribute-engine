import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ ai: demoDashboard.ai })
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      ok: true,
      report: {
        status: 'ready',
        summary: 'Weekly report generated from member activity, access events, payments, and referral growth.',
        suggestions: demoDashboard.ai.suggestions,
      },
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
