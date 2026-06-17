import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ setup: demoDashboard.setup })
  }

  if (req.method === 'POST') {
    return res.status(200).json({
      ok: true,
      setup: demoDashboard.setup.map((step) => (step.id === req.body?.stepId ? { ...step, status: 'done' } : step)),
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
