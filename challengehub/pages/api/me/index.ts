import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { getUserXp } from '@/lib/xp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, telegram_id, username')
      .eq('id', userId)
      .single()
    if (error) throw error

    const { xp, level } = await getUserXp(userId)

    const { data: memberships, error: memErr } = await supabase
      .from('challenge_members')
      .select('challenge_id, status, challenges(id, title, status)')
      .eq('user_id', userId)
      .eq('status', 'active')
    if (memErr) throw memErr

    const activeChallenges = (memberships ?? [])
      .map((m: any) => m.challenges)
      .filter(Boolean)
      .map((c: any) => ({ id: c.id, title: c.title, status: c.status }))

    res.status(200).json({
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      xp,
      level,
      activeChallenges,
    })
  } catch (error) {
    console.error('me/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
