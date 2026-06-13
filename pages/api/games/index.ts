import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { demoGames } from '@/lib/demo-data'
import { getRemainingPlays, TAP_GAME_MAX_PLAYS_PER_DAY, SPIN_WHEEL_MAX_PLAYS_PER_DAY } from '@/lib/minigames'
import { GameDto } from '@/lib/api-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoGames())

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const [tapRemaining, spinRemaining] = await Promise.all([
      getRemainingPlays(userId, 'tap'),
      getRemainingPlays(userId, 'spin'),
    ])

    const games: GameDto[] = [
      {
        id: 'tap',
        title: 'Coin Catcher',
        description: 'Tap falling BTC/ETH/TON coins for 30 seconds',
        icon: '🪙',
        remainingPlays: tapRemaining,
        maxPlaysPerDay: TAP_GAME_MAX_PLAYS_PER_DAY,
      },
      {
        id: 'spin',
        title: 'Daily Spin',
        description: 'One free spin every day for bonus rewards',
        icon: '🎡',
        remainingPlays: spinRemaining,
        maxPlaysPerDay: SPIN_WHEEL_MAX_PLAYS_PER_DAY,
      },
      {
        id: 'gomoku',
        title: 'Gomoku Blitz',
        description: '8x8 connect-5 vs computer or a live remote player',
        icon: 'GX',
        remainingPlays: 1,
        maxPlaysPerDay: 1,
      },
    ]

    res.status(200).json({ games })
  } catch (error) {
    console.error('games/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
