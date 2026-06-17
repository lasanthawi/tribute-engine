import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ products: demoDashboard.products })
  }

  if (req.method === 'POST') {
    return res.status(201).json({
      product: {
        id: Date.now(),
        title: req.body?.title ?? 'Untitled product',
        type: req.body?.type ?? 'download',
        status: 'draft',
        purchases: 0,
        priceStars: Number(req.body?.priceStars ?? 0),
      },
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
