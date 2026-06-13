import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { playGomokuMove } from '@/lib/gomoku'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(400).json({ error: 'Remote rooms need Telegram auth and Supabase' })

  const { matchId, row, col } = req.body ?? {}
  if (
    typeof matchId !== 'number' ||
    typeof row !== 'number' ||
    typeof col !== 'number' ||
    !Number.isInteger(matchId) ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  ) {
    return res.status(400).json({ error: 'Invalid move' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const match = await playGomokuMove(userId, matchId, row, col)
    res.status(200).json({ match })
  } catch (error: any) {
    if (
      [
        'Room not found',
        'Match is not active',
        'Not in this room',
        'Not your turn',
        'Move is outside the board',
        'Cell is already occupied',
      ].includes(error?.message)
    ) {
      return res.status(400).json({ error: error.message })
    }
    console.error('games/gomoku/move error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
