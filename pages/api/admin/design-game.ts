// VOTE LEAGUE — manually trigger the self-evolving game-designer pipeline
// with a specific creative brief, instead of waiting for the weekly cron to
// pick one at random. Runs the exact same design -> test gate -> publish ->
// announce flow as pages/api/cron/game-designer.ts.

import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { MAX_PUBLISHED_GAMES, TapCatchConfig } from '@/lib/game-templates'
import { getAllGames, listGamesByStatus, createGame } from '@/lib/games-catalog'
import { designNewGame, testGameConfig } from '@/lib/game-agent'
import { generateCoverImage } from '@/lib/game-images'
import { announceNewGame, notifyAdmins } from '@/lib/game-promos'
import { broadcastNewGame } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(200).json({ ok: true, skipped: 'demo mode' })

  const { creativeBrief } = req.body ?? {}
  if (typeof creativeBrief !== 'string' || !creativeBrief.trim()) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const existingGames = await getAllGames()
    const published = await listGamesByStatus('published')
    if (published.length >= MAX_PUBLISHED_GAMES) {
      return res.status(400).json({ error: 'Catalog is full — retire a game before designing a new one' })
    }

    let proposal
    try {
      proposal = await designNewGame({ existingGames, creativeBrief: creativeBrief.trim() })
    } catch (error) {
      console.error('admin/design-game: designNewGame failed:', error)
      return res.status(502).json({ error: 'Design step unavailable' })
    }

    const testResult = testGameConfig(proposal, existingGames)

    const tapConfig = proposal.template === 'tap_catch' ? (proposal.config as TapCatchConfig) : null
    const coverImageUrl = await generateCoverImage({
      slug: proposal.slug,
      title: proposal.title,
      description: proposal.description,
      icon: proposal.icon,
      imagePrompt: proposal.imagePrompt,
      accentColor: proposal.accentColor,
      objects: tapConfig ? [...tapConfig.objects, ...(tapConfig.hazards ?? [])] : undefined,
      direction: tapConfig?.direction,
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
      const { data: users } = await supabase.from('users').select('telegram_id').eq('notifications_enabled', true)
      const telegramIds = (users ?? []).map((u) => u.telegram_id)
      await broadcastNewGame(telegramIds, created.title, created.icon, proposal.promoCopy)
    } else {
      await notifyAdmins(
        `⚠️ admin/design-game: proposal "${created.slug}" failed the test gate and was saved as retired.\n${testResult.errors.join('\n')}`
      )
    }

    return res.status(200).json({
      ok: true,
      created: { slug: created.slug, title: created.title, status: created.status },
      testResult,
    })
  } catch (error) {
    console.error('admin/design-game error:', error)
    return res.status(500).json({ error: 'Internal error' })
  }
}
