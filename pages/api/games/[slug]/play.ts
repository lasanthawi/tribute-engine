import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { demoGames } from '@/lib/demo-data'
import { playTapGame, spinWheel } from '@/lib/minigames'
import { computeTapRewardFromCurve, computeRewardFromCurve, pickSpinSegment, TapCatchConfig, SpinWheelConfig, SnakeConfig } from '@/lib/game-templates'
import { PlayResultDto } from '@/lib/api-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { slug } = req.query
  if (typeof slug !== 'string') return res.status(400).json({ error: 'Invalid request' })

  if (isDemoMode()) {
    const game = demoGames().games.find((g) => g.slug === slug)
    if (!game) return res.status(404).json({ error: 'Game not found' })

    if (game.template === 'tap_catch') {
      const { score } = req.body ?? {}
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid request' })
      }
      const config = game.config as TapCatchConfig
      const clampedScore = Math.min(score, config.maxScore)
      const result: PlayResultDto = {
        rewardPoints: computeTapRewardFromCurve(clampedScore, config),
        rewardTickets: 0,
        rewardCoins: 0,
        remainingPlays: 2,
      }
      return res.status(200).json(result)
    }

    if (game.template === 'snake_run') {
      const { score } = req.body ?? {}
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid request' })
      }
      const config = game.config as SnakeConfig
      const clampedScore = Math.min(score, config.maxScore)
      const result: PlayResultDto = {
        rewardPoints: computeRewardFromCurve(clampedScore, config.maxScore, config.rewardCurve),
        rewardTickets: 0,
        rewardCoins: 0,
        remainingPlays: 2,
      }
      return res.status(200).json(result)
    }

    if (game.template === 'spin_wheel') {
      const config = game.config as SpinWheelConfig
      const { segmentIndex, segment } = pickSpinSegment(config)
      const result: PlayResultDto = {
        rewardPoints: segment.rewardPoints,
        rewardTickets: segment.rewardTickets,
        rewardCoins: segment.rewardCoins,
        remainingPlays: 0,
        segmentIndex,
      }
      return res.status(200).json(result)
    }

    return res.status(500).json({ error: 'Unsupported game template' })
  }

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { score } = req.body ?? {}

    if (typeof score === 'number') {
      if (!Number.isInteger(score) || score < 0) {
        return res.status(400).json({ error: 'Invalid request' })
      }
      const result = await playTapGame(userId, slug, score)
      return res.status(200).json({ ...result, rewardTickets: 0, rewardCoins: 0 } satisfies PlayResultDto)
    }

    const result = await spinWheel(userId, slug)
    res.status(200).json(result satisfies PlayResultDto)
  } catch (error: any) {
    if (error?.message === 'No plays remaining') {
      return res.status(400).json({ error: 'No plays remaining today' })
    }
    if (error?.message === 'Game not found') {
      return res.status(404).json({ error: 'Game not found' })
    }
    console.error('games/[slug]/play error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
