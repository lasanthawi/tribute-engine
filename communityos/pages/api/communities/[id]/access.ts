import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import {
  approveJoinRequest,
  declineJoinRequest,
  grantMemberAccess,
  listAccessLogs,
  listChats,
  listJoinRequests,
  restoreMemberAccess,
  revokeMemberAccess,
  setCommentAccess,
  suspendMemberAccess,
  syncPendingAccess,
} from '@/lib/access-control'
import { listMembers, requireCommunityOwner } from '@/lib/communities'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ownerId = await requireUser(req, res)
  if (ownerId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(ownerId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const [chats, members, logs, joinRequests] = await Promise.all([
        listChats(communityId),
        listMembers(communityId),
        listAccessLogs(communityId),
        listJoinRequests(communityId),
      ])
      const queue = members.filter((m) => ['pending', 'failed', 'expired', 'suspended', 'revoked'].includes(m.accessStatus))
      return res.status(200).json({ chats, queue, logs, joinRequests })
    }

    if (req.method === 'POST') {
      const { action, userId: targetUserId } = req.body ?? {}
      if (action === 'grant') {
        if (typeof targetUserId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await grantMemberAccess(communityId, targetUserId))
      }
      if (action === 'revoke') {
        if (typeof targetUserId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await revokeMemberAccess(communityId, targetUserId))
      }
      if (action === 'suspend') {
        if (typeof targetUserId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await suspendMemberAccess(communityId, targetUserId))
      }
      if (action === 'restore') {
        if (typeof targetUserId !== 'number') return res.status(400).json({ error: 'userId is required' })
        return res.status(200).json(await restoreMemberAccess(communityId, targetUserId))
      }
      if (action === 'approve_join' || action === 'decline_join') {
        const joinRequestId = Number(req.body?.joinRequestId)
        if (!Number.isFinite(joinRequestId)) return res.status(400).json({ error: 'joinRequestId is required' })
        const result =
          action === 'approve_join'
            ? await approveJoinRequest(communityId, joinRequestId, ownerId)
            : await declineJoinRequest(communityId, joinRequestId, ownerId)
        return res.status(result.ok ? 200 : 404).json(result)
      }
      if (action === 'sync') {
        return res.status(200).json({ ok: true, ...(await syncPendingAccess(communityId)) })
      }
      if (action === 'set_comment_access') {
        const enabled = !!req.body?.enabled
        const result = await setCommentAccess(communityId, enabled)
        return res.status(result.ok ? 200 : 400).json(result)
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
