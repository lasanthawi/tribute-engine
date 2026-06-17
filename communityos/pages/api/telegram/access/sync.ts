import { NextApiRequest, NextApiResponse } from 'next'
import { syncPendingAccess } from '@/lib/access-control'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  try {
    const result = await syncPendingAccess()
    res.status(200).json({ ok: true, ...result })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'PGRST205'
    ) {
      return res.status(200).json({
        ok: false,
        setupRequired: true,
        error: 'CommunityOS database migration has not been applied yet.',
      })
    }

    console.error('telegram/access/sync error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
