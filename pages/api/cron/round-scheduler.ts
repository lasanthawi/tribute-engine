import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { scheduleUpcomingRounds } from '@/lib/rounds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  try {
    await scheduleUpcomingRounds()
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('round-scheduler error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
