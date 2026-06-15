import { NextApiRequest, NextApiResponse } from 'next'

export function rejectUnauthorizedCron(req: NextApiRequest, res: NextApiResponse): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.authorization
  if (header === `Bearer ${secret}`) return false

  res.status(401).json({ error: 'Unauthorized' })
  return true
}
