import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { joinGomokuMatch } from '@/lib/gomoku'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(400).json({ error: 'Remote rooms need Telegram auth and Supabase' })

  const { shareCode } = req.body ?? {}
  if (typeof shareCode !== 'string' || shareCode.trim().length < 4) {
    return res.status(400).json({ error: 'Enter a valid room code' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const match = await joinGomokuMatch(userId, shareCode)
    res.status(200).json({ match })
  } catch (error: any) {
    if (['Room not found', 'Room is already full'].includes(error?.message)) {
      return res.status(400).json({ error: error.message })
    }
    console.error('games/gomoku/join error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
