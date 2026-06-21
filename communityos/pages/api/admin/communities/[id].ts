import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { getAdminCommunityDetail, setCommunityStatus } from '@/lib/admin'

const ACTION_STATUS: Record<string, 'active' | 'paused' | 'archived'> = {
  activate: 'active',
  pause: 'paused',
  archive: 'archived',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  const communityId = Number(req.query.id)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    if (req.method === 'GET') {
      const detail = await getAdminCommunityDetail(communityId)
      if (!detail) return res.status(404).json({ error: 'Community not found' })
      return res.status(200).json(detail)
    }

    if (req.method === 'POST') {
      const status = ACTION_STATUS[String(req.body?.action)]
      if (!status) return res.status(400).json({ error: 'Unknown action' })
      const result = await setCommunityStatus(communityId, status, adminId)
      return res.status(200).json({ ok: true, ...result })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('admin/communities/[id] error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
