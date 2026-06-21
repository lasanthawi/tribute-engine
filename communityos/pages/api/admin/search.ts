import { NextApiRequest, NextApiResponse } from 'next'
import { requirePlatformAdmin } from '@/lib/api-auth'
import { adminSearch } from '@/lib/admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminId = await requirePlatformAdmin(req, res)
  if (adminId === null) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    return res.status(200).json(await adminSearch(q))
  } catch (error) {
    console.error('admin/search error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
