import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { recordAuditEvent } from '@/lib/admin'
import { revokeMemberAccess, restoreMemberAccess, syncPendingAccess } from '@/lib/access-control'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, communityId, userId } = req.body ?? {}

  try {
    if (action === 'sync') {
      const result = await syncPendingAccess(typeof communityId === 'number' ? communityId : undefined)
      await recordAuditEvent({ actorUserId: adminId, communityId: communityId ?? null, eventType: 'access_synced', payload: result })
      return res.status(200).json({ ok: true, ...result })
    }

    if (action === 'revoke' || action === 'restore') {
      if (typeof communityId !== 'number' || typeof userId !== 'number') {
        return res.status(400).json({ error: 'communityId and userId are required' })
      }
      if (action === 'revoke') await revokeMemberAccess(communityId, userId)
      else await restoreMemberAccess(communityId, userId)
      await recordAuditEvent({
        actorUserId: adminId,
        communityId,
        eventType: action === 'revoke' ? 'member_revoked' : 'member_restored',
        payload: { userId },
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (error) {
    console.error('admin/members error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
