import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { grantMemberAccess, listAccessLogs, listChats, revokeMemberAccess } from '@/lib/access-control'
import { listMembers, requireCommunityOwner } from '@/lib/communities'
import { demoDashboard } from '@/lib/demo-data'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  if (isDemoMode) {
    if (req.method === 'GET')
      return res.status(200).json({
        chats: demoDashboard.chats,
        queue: demoDashboard.members.filter((m) => m.accessStatus === 'pending' || m.accessStatus === 'failed'),
        logs: demoDashboard.accessLogs,
      })
    if (req.method === 'POST') return res.status(200).json({ ok: true })
  }

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const [chats, members, logs] = await Promise.all([
        listChats(communityId),
        listMembers(communityId),
        listAccessLogs(communityId),
      ])
      const queue = members.filter((m) => m.accessStatus === 'pending' || m.accessStatus === 'failed')
      return res.status(200).json({ chats, queue, logs })
    }

    if (req.method === 'POST') {
      const { action, userId } = req.body ?? {}
      if (action === 'grant') {
        if (typeof userId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await grantMemberAccess(communityId, userId))
      }
      if (action === 'revoke') {
        if (typeof userId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await revokeMemberAccess(communityId, userId))
      }
      return res.status(400).json({ error: 'Unknown action' })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/access error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
