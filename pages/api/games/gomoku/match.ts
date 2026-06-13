import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { getGomokuMatch } from '@/lib/gomoku'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(400).json({ error: 'Remote rooms need Telegram auth and Supabase' })

  const id = Number(req.query.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid room' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const match = await getGomokuMatch(userId, id)
    res.status(200).json({ match })
  } catch (error: any) {
    if (['Room not found', 'Not in this room'].includes(error?.message)) {
      return res.status(404).json({ error: error.message })
    }
    console.error('games/gomoku/match error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
