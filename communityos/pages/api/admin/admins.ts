import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { addPlatformAdmin, listPlatformAdmins, removePlatformAdmin } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ admins: await listPlatformAdmins() })
    }

    if (req.method === 'POST') {
      const telegramId = Number(req.body?.telegramId)
      const userId = Number(req.body?.userId)
      const role = typeof req.body?.role === 'string' ? req.body.role : 'operator'
      const result = await addPlatformAdmin(
        {
          telegramId: Number.isFinite(telegramId) ? telegramId : undefined,
          userId: Number.isFinite(userId) ? userId : undefined,
          role,
        },
        adminId
      )
      return res.status(result.ok ? 200 : 400).json(result)
    }

    if (req.method === 'DELETE') {
      const userId = Number(req.query.userId ?? req.body?.userId)
      if (!Number.isFinite(userId)) return res.status(400).json({ error: 'userId is required' })
      const result = await removePlatformAdmin(userId, adminId)
      return res.status(result.ok ? 200 : 400).json(result)
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('admin/admins error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
