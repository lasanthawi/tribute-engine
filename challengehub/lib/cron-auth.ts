import { NextApiRequest, NextApiResponse } from 'next'

/** Returns true and writes a 401 response if the request isn't authorized. */
export function rejectUnauthorizedCron(req: NextApiRequest, res: NextApiResponse): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // no secret configured — allow (local/dev)

  const authHeader = req.headers.authorization
  if (authHeader === `Bearer ${secret}`) return false

  res.status(401).json({ error: 'Unauthorized' })
  return true
}
