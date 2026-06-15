// VOTE LEAGUE — manually re-trigger the new-game announcement for a game
// that was published outside the autonomous game-designer flow (e.g.
// inserted directly into the catalog). Posts to the official channel and
// DMs every opted-in user, same as the autonomous publisher would.

import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { isDemoMode } from '@/lib/demo'
import { getGameBySlug } from '@/lib/games-catalog'
import { announceNewGame } from '@/lib/game-promos'
import { broadcastNewGame } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (isDemoMode()) return res.status(200).json({ ok: true, skipped: 'demo mode' })

  const { slug, promoCopy } = req.body ?? {}
  if (typeof slug !== 'string' || !slug.trim() || typeof promoCopy !== 'string' || !promoCopy.trim()) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  try {
    const game = await getGameBySlug(slug.trim())
    if (!game) return res.status(404).json({ error: 'Game not found' })

    await announceNewGame(game, promoCopy)

    const { data: users, error } = await supabase.from('users').select('telegram_id').eq('notifications_enabled', true)
    if (error) throw error
    const telegramIds = (users ?? []).map((u) => u.telegram_id)
    const notified = await broadcastNewGame(telegramIds, game.title, game.icon, promoCopy)

    return res.status(200).json({ ok: true, slug: game.slug, notified })
  } catch (error) {
    console.error('admin/announce-game error:', error)
    return res.status(500).json({ error: 'Internal error' })
  }
}
