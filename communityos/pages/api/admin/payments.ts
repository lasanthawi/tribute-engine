import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { listAdminPayments } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const communityId = Number(req.query.communityId)
    const days = Number(req.query.days)
    const payments = await listAdminPayments({
      status,
      communityId: Number.isFinite(communityId) ? communityId : undefined,
      days: Number.isFinite(days) ? days : undefined,
    })
    return res.status(200).json({ payments })
  } catch (error) {
    console.error('admin/payments error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
