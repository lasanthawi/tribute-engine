import { NextApiRequest, NextApiResponse } from 'next'
import { authenticateRequest } from './telegram-auth'

/** Authenticates the request via the x-telegram-init-data header, or writes a 401. */
export async function requireUser(req: NextApiRequest, res: NextApiResponse): Promise<number | null> {
  const initData = req.headers['x-telegram-init-data']
  const userId = await authenticateRequest(typeof initData === 'string' ? initData : undefined)
  if (userId === null) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return userId
}
