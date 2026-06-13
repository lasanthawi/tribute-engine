import { NextApiRequest, NextApiResponse } from 'next'
import { COIN_PACKAGES } from '@/lib/coins'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  res.status(200).json({ packages: COIN_PACKAGES })
}
