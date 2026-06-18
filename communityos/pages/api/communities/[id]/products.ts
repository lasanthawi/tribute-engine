import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { archiveProduct, createProduct, listProducts } from '@/lib/payments'

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
      const { title, type, priceStars, description, buttonText, coverPath, deliveryType, deliveryText, deliveryUrl, filePath, fileName } = req.body ?? {}
      if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' })
      const product = await createProduct(communityId, {
        title,
        type,
        priceStars: Number(priceStars ?? 0),
        description: typeof description === 'string' ? description : undefined,
        buttonText: typeof buttonText === 'string' ? buttonText : undefined,
        coverPath: typeof coverPath === 'string' ? coverPath : null,
        deliveryType,
        deliveryText: typeof deliveryText === 'string' ? deliveryText : undefined,
        deliveryUrl: typeof deliveryUrl === 'string' ? deliveryUrl : undefined,
        filePath: typeof filePath === 'string' ? filePath : null,
        fileName: typeof fileName === 'string' ? fileName : null,
        status: 'active',
      })
      return res.status(201).json({ product })
    }
    if (req.method === 'DELETE') {
      const productId = Number(req.query.productId ?? req.body?.productId)
      if (!Number.isFinite(productId)) return res.status(400).json({ error: 'productId is required' })
      return res.status(200).json({ ok: true, product: await archiveProduct(communityId, productId) })
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/products error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
