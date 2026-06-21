import { NextApiRequest, NextApiResponse } from 'next'
import { authenticateRequest } from './telegram-auth'
import { isPlatformAdmin } from './admin'

export async function requireUser(req: NextApiRequest, res: NextApiResponse): Promise<number | null> {
  const initData = req.headers['x-telegram-init-data']
  const userId = await authenticateRequest(typeof initData === 'string' ? initData : undefined)
  if (userId === null) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return userId
}

// Gate for platform-admin-only API routes. Mirrors requireUser, then checks the
// caller is a platform admin (platform_admins row or ADMIN_TELEGRAM_IDS bootstrap).
export async function requirePlatformAdmin(req: NextApiRequest, res: NextApiResponse): Promise<number | null> {
  const userId = await requireUser(req, res)
  if (userId === null) return null
  if (!(await isPlatformAdmin(userId))) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return userId
}
