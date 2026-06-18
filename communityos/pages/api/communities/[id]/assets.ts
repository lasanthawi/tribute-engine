import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { uploadCommunityAsset } from '@/lib/assets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const { fileName, mimeType, dataUrl, assetType } = req.body ?? {}
    if (!fileName || typeof fileName !== 'string') return res.status(400).json({ error: 'fileName is required' })
    if (!mimeType || typeof mimeType !== 'string') return res.status(400).json({ error: 'mimeType is required' })
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl is required' })
    if (assetType !== 'cover' && assetType !== 'delivery') return res.status(400).json({ error: 'Invalid assetType' })

    const asset = await uploadCommunityAsset(communityId, { fileName, mimeType, dataUrl, assetType })
    res.status(201).json({ asset })
  } catch (error: any) {
    console.error('communities/[id]/assets error:', error)
    res.status(500).json({ error: error?.message || 'Internal error' })
  }
}
