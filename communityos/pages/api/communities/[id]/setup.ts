import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { computeSetup } from '@/lib/setup'
import { demoDashboard } from '@/lib/demo-data'
import { isDemoMode } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  if (isDemoMode) return res.status(200).json({ setup: demoDashboard.setup })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    return res.status(200).json({ setup: await computeSetup(communityId) })
  } catch (error) {
    console.error('communities/[id]/setup error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
