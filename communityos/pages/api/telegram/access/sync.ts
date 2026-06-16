import { NextApiRequest, NextApiResponse } from 'next'
import { syncPendingAccess } from '@/lib/access-control'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  if (isDemoMode) return res.status(200).json({ ok: true, scanned: 3, synced: 2, demo: true })

  try {
    const result = await syncPendingAccess()
    res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('telegram/access/sync error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
