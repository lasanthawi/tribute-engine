import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { archiveEvent, createEvent, listEvents, registerEvent } from '@/lib/events'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ events: await listEvents(communityId, userId) })
    }
    if (req.method === 'POST') {
      if (req.body?.action === 'register') {
        const eventId = Number(req.body?.eventId)
        if (!Number.isFinite(eventId)) return res.status(400).json({ error: 'eventId is required' })
        const result = await registerEvent(communityId, userId, eventId)
        if (!result.ok) return res.status(400).json({ error: result.reason })
        return res.status(200).json({ ok: true })
      }

      const allowed = await requireCommunityOwner(userId, communityId)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })

      const { title, type, startsAt, priceStars, description, coverPath, accessLink } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const event = await createEvent(communityId, {
        title,
        type,
        startsAt,
        priceStars: Number(priceStars ?? 0),
        description: typeof description === 'string' ? description : undefined,
        coverPath: typeof coverPath === 'string' ? coverPath : null,
        accessLink: typeof accessLink === 'string' ? accessLink : undefined,
      })
      return res.status(201).json({ event })
    }
    if (req.method === 'DELETE') {
      const allowed = await requireCommunityOwner(userId, communityId)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })
      const eventId = Number(req.query.eventId ?? req.body?.eventId)
      if (!Number.isFinite(eventId)) return res.status(400).json({ error: 'eventId is required' })
      return res.status(200).json({ ok: true, event: await archiveEvent(communityId, eventId) })
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/events error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
