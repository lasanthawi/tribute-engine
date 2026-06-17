import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { createProduct, listProducts } from '@/lib/payments'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      return res.status(200).json({ products: await listProducts(communityId) })
    }
    if (req.method === 'POST') {
      const { title, type, priceStars } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const product = await createProduct(communityId, { title, type, priceStars: Number(priceStars ?? 0) })
      return res.status(201).json({ product })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/products error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
