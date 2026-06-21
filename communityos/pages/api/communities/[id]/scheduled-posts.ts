import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { activateScheduledPost, listScheduledPosts, pauseScheduledPost } from '@/lib/auto-posting'
import { requireCommunityOwner } from '@/lib/communities'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      return res.status(200).json({ scheduledPosts: await listScheduledPosts(communityId) })
    }

    if (req.method === 'POST') {
      const { action, targetType, targetId } = req.body ?? {}
      if (!['plan', 'product', 'event'].includes(targetType) || !Number.isFinite(Number(targetId))) {
        return res.status(400).json({ error: 'targetType and targetId are required' })
      }

      if (action === 'activate') {
        const intervalHours = Math.max(1, Math.round(Number(req.body?.intervalHours)) || 168)
        const scheduledPost = await activateScheduledPost(communityId, targetType, Number(targetId), intervalHours)
        return res.status(200).json({ ok: true, scheduledPost })
      }

      if (action === 'pause') {
        const scheduledPost = await pauseScheduledPost(communityId, targetType, Number(targetId))
        return res.status(200).json({ ok: true, scheduledPost })
      }

      return res.status(400).json({ error: 'Unknown action' })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/scheduled-posts error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
