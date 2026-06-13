import { NextApiRequest, NextApiResponse } from 'next'
import { isDemoMode } from '@/lib/demo'
import { demoSentiment } from '@/lib/demo-data'
import { getFearGreedIndex, getNewsHeadlines } from '@/lib/sentiment'
import { Asset } from '@/lib/supabase'

const ASSETS: Asset[] = ['BTC', 'ETH', 'TON']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoSentiment())

  const assetParam = typeof req.query.asset === 'string' ? req.query.asset.toUpperCase() : undefined
  const asset = ASSETS.includes(assetParam as Asset) ? (assetParam as Asset) : undefined

  try {
    const [fearGreed, headlines] = await Promise.all([getFearGreedIndex(), getNewsHeadlines(asset)])
    res.status(200).json({ fearGreed, headlines })
  } catch (error) {
    console.error('sentiment/index error:', error)
    res.status(200).json({ fearGreed: null, headlines: [] })
  }
}
