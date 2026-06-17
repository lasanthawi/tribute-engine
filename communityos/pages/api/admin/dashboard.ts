import { NextApiRequest, NextApiResponse } from 'next'
import { getAdminDashboard, isPlatformAdmin } from '@/lib/admin'
import { requireUser } from '@/lib/api-auth'
import { demoAdminDashboard } from '@/lib/demo-data'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  if (isDemoMode) return res.status(200).json({ dashboard: demoAdminDashboard })

  try {
    if (!(await isPlatformAdmin(userId))) return res.status(403).json({ error: 'Forbidden' })
    return res.status(200).json({ dashboard: await getAdminDashboard() })
  } catch (error) {
    console.error('admin/dashboard error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
