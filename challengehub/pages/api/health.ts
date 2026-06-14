import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true, service: 'challengehub', time: new Date().toISOString() })
}
