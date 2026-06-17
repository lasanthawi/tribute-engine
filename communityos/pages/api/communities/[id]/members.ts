import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { ensureMember, listMembers, requireCommunityOwner } from '@/lib/communities'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ownerId = await requireUser(req, res)
  if (ownerId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(ownerId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const members = await listMembers(communityId)
      return res.status(200).json({ members })
    }

    if (req.method === 'POST') {
      const { userId, source } = req.body ?? {}
      if (typeof userId !== 'number') return res.status(400).json({ error: 'userId is required' })
      const member = await ensureMember(communityId, userId, { source: typeof source === 'string' ? source : 'direct' })
      return res.status(201).json({ member })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/members error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
