// VOTE LEAGUE — weekly self-evolving mini-game publisher
//
// Flow: if the catalog is at MAX_PUBLISHED_GAMES, retire the worst performer
// (by trailing-7-day unique players) to free a slot. Ask Claude to design a
// new game, generate its cover art, and run it through the automated test
// gate. If it passes, publish it and announce it; if it fails, save it as
// 'retired' (visible to admins, never shown to players) and notify admins
// with the failure reasons.

import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { MAX_PUBLISHED_GAMES } from '@/lib/game-templates'
import { getAllGames, listGamesByStatus, createGame, setGameStatus } from '@/lib/games-catalog'
import { pickWorstPerformer } from '@/lib/game-analytics'
import { designNewGame, testGameConfig } from '@/lib/game-agent'
import { generateCoverImage } from '@/lib/game-images'
import { announceNewGame, notifyAdmins } from '@/lib/game-promos'

const CREATIVE_BRIEFS = [
  'A fast-paced reflex game with a fresh visual theme not used elsewhere in the catalog.',
  'A spin-the-wheel variant with an unusual segment layout or theme.',
  'A reflex game themed around a different crypto/market motif (e.g. charts, mining, NFTs).',
  'A wheel with a higher number of small, frequent wins for a "lots of little dopamine hits" feel.',
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (isDemoMode()) return res.status(200).json({ ok: true, skipped: 'demo mode' })

  try {
    const existingGames = await getAllGames()
    const published = await listGamesByStatus('published')

    let retiredSlug: string | null = null
    if (published.length >= MAX_PUBLISHED_GAMES) {
      // tap/spin are the original, hand-tuned games — never auto-retire them.
      const candidates = published.filter((g) => g.slug !== 'tap' && g.slug !== 'spin').map((g) => g.slug)
      retiredSlug = await pickWorstPerformer(candidates)
      if (!retiredSlug) {
        return res.status(200).json({ ok: true, skipped: 'catalog full and no retireable game found' })
      }
      const toRetire = published.find((g) => g.slug === retiredSlug)
      if (toRetire) await setGameStatus(toRetire.id, 'retired')
    }

    const creativeBrief = CREATIVE_BRIEFS[Math.floor(Math.random() * CREATIVE_BRIEFS.length)]

    let proposal
    try {
      proposal = await designNewGame({ existingGames, creativeBrief })
    } catch (error) {
      console.error('game-designer: designNewGame failed:', error)
      return res.status(200).json({ ok: true, skipped: 'design step unavailable', retiredSlug })
    }

    const testResult = testGameConfig(proposal, existingGames)

    const coverImageUrl = await generateCoverImage({
      slug: proposal.slug,
      title: proposal.title,
      description: proposal.description,
      icon: proposal.icon,
      imagePrompt: proposal.imagePrompt,
      accentColor: proposal.accentColor,
    })

    const created = await createGame({
      slug: proposal.slug,
      template: proposal.template,
      title: proposal.title,
      description: proposal.description,
      icon: proposal.icon,
      config: proposal.config,
      coverImageUrl,
      maxPlaysPerDay: proposal.template === 'spin_wheel' ? 1 : 3,
      status: testResult.passed ? 'published' : 'retired',
    })

    if (testResult.passed) {
      await announceNewGame(created, proposal.promoCopy)
    } else {
      await notifyAdmins(
        `⚠️ game-designer: proposal "${created.slug}" failed the test gate and was saved as retired.\n${testResult.errors.join('\n')}`
      )
    }

    return res.status(200).json({
      ok: true,
      retiredSlug,
      created: { slug: created.slug, status: created.status },
      testResult,
    })
  } catch (error) {
    console.error('game-designer cron error:', error)
    return res.status(500).json({ error: 'Internal error' })
  }
}
