import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ events: demoDashboard.events })
  }

  if (req.method === 'POST') {
    return res.status(201).json({
      event: {
        id: Date.now(),
        title: req.body?.title ?? 'Untitled event',
        type: req.body?.type ?? 'webinar',
        startsAt: req.body?.startsAt ?? new Date().toISOString(),
        registrations: 0,
        priceStars: Number(req.body?.priceStars ?? 0),
      },
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
