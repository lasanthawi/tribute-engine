import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isPlatformAdmin } from '@/lib/admin'
import { getCommissionRateBps, getPlatformCommissionTotals, setCommissionRateBps } from '@/lib/platform-settings'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    if (!(await isPlatformAdmin(userId))) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const [commissionRateBps, totals] = await Promise.all([getCommissionRateBps(), getPlatformCommissionTotals()])
      return res.status(200).json({ commissionRateBps, ...totals })
    }

    if (req.method === 'PATCH') {
      const { commissionRateBps } = req.body ?? {}
      if (typeof commissionRateBps !== 'number' || !Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > 10000) {
        return res.status(400).json({ error: 'commissionRateBps must be an integer between 0 and 10000' })
      }
      const updated = await setCommissionRateBps(commissionRateBps)
      return res.status(200).json({ commissionRateBps: updated })
    }

    res.setHeader('Allow', ['GET', 'PATCH'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('admin/settings error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
