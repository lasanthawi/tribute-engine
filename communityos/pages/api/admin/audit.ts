import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { listAuditEvents } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const communityId = Number(req.query.communityId)
    const actorId = Number(req.query.actorId)
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const events = await listAuditEvents({
      communityId: Number.isFinite(communityId) ? communityId : undefined,
      actorId: Number.isFinite(actorId) ? actorId : undefined,
      type,
    })
    return res.status(200).json({ events })
  } catch (error) {
    console.error('admin/audit error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
