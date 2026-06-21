import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { resolveAccessIssue } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, logId } = req.body ?? {}

  try {
    if (action === 'resolve') {
      if (!Number.isFinite(Number(logId))) return res.status(400).json({ error: 'logId is required' })
      const result = await resolveAccessIssue(Number(logId), adminId)
      return res.status(200).json(result)
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (error) {
    console.error('admin/issues error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
