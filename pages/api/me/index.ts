import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { getUserBalance } from '@/lib/ledger'
import { getStreakMultiplier } from '@/lib/streak'
import { isDemoMode } from '@/lib/demo'
import { demoMe } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoMe())

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, streak_count')
      .eq('id', userId)
      .single()
    if (error) throw error

    const balance = await getUserBalance(userId)

    res.status(200).json({
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      points: balance.points,
      tickets: balance.tickets,
      streak: user.streak_count,
      streakMultiplier: getStreakMultiplier(user.streak_count),
    })
  } catch (error) {
    console.error('me/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
