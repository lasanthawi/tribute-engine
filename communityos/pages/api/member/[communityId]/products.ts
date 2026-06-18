import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { ensureMember } from '@/lib/communities'
import { listProducts, unlockFreeProduct } from '@/lib/payments'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.communityId)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    await ensureMember(communityId, userId, { accessStatus: 'pending', source: 'member_dashboard' })

    if (req.method === 'GET') {
      return res.status(200).json({ products: await listProducts(communityId, userId) })
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action ?? '')
      const productId = Number(req.body?.productId)
      if (!Number.isFinite(productId)) return res.status(400).json({ error: 'productId is required' })

      if (action === 'unlock_free') {
        const result = await unlockFreeProduct(communityId, userId, productId)
        if (!result.ok) return res.status(400).json({ error: result.reason })
        return res.status(200).json({ ok: true, product: result.product })
      }

      return res.status(400).json({ error: 'Unsupported product action' })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('member/[communityId]/products error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
