import { NextApiRequest, NextApiResponse } from 'next'
import { demoAdminDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({ dashboard: demoAdminDashboard })
}
