import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stars = Math.max(1, Number(req.body?.stars ?? 1))
  const title = String(req.body?.title ?? 'CommunityOS purchase')
  const payload = `communityos:${req.query.id}:${Date.now()}`

  return res.status(200).json({
    invoice: {
      title,
      description: req.body?.description ?? 'Telegram Stars purchase for CommunityOS.',
      payload,
      currency: 'XTR',
      prices: [{ label: title, amount: stars }],
    },
  })
}
