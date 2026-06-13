import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { createGomokuMatch } from '@/lib/gomoku'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(400).json({ error: 'Remote rooms need Telegram auth and Supabase' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const match = await createGomokuMatch(userId)
    res.status(201).json({ match })
  } catch (error) {
    console.error('games/gomoku/create error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
