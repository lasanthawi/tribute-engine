import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { demoGames } from '@/lib/demo-data'
import { getRemainingPlays } from '@/lib/minigames'
import { getPublishedGames } from '@/lib/games-catalog'
import { GameDto } from '@/lib/api-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoGames())

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const catalog = await getPublishedGames()

    const games: GameDto[] = await Promise.all(
      catalog.map(async (game) => ({
        slug: game.slug,
        template: game.template,
        title: game.title,
        description: game.description,
        icon: game.icon,
        config: game.config,
        coverImageUrl: game.coverImageUrl,
        remainingPlays: await getRemainingPlays(userId, game.slug, game.maxPlaysPerDay),
        maxPlaysPerDay: game.maxPlaysPerDay,
      }))
    )

    res.status(200).json({ games })
  } catch (error) {
    console.error('games/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
