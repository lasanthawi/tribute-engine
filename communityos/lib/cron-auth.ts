import { NextApiRequest, NextApiResponse } from 'next'

export function rejectUnauthorizedCron(req: NextApiRequest, res: NextApiResponse): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    res.status(500).json({ error: 'CRON_SECRET is not configured' })
    return true
  }

  const header = req.headers.authorization
  if (header === `Bearer ${secret}`) return false

  res.status(401).json({ error: 'Unauthorized' })
  return true
}
