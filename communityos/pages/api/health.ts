import { NextApiRequest, NextApiResponse } from 'next'
import { isDemoMode } from '@/lib/supabase'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true, app: 'communityos', demoMode: isDemoMode })
}
