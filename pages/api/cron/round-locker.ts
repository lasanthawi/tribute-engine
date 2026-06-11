import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { lockDueRounds } from '@/lib/rounds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  try {
    const result = await lockDueRounds()
    res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('round-locker error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
