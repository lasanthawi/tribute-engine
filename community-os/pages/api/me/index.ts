import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

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

    const { data: profile, error: profileErr } = await supabase
      .from('community_profiles')
      .select('display_name, bio, role_title, status, joined_at')
      .eq('user_id', userId)
      .single()
    if (profileErr) throw profileErr

    const { data: rsvps, error: rsvpErr } = await supabase
      .from('event_rsvps')
      .select('community_events(id, title, event_at, status)')
      .eq('user_id', userId)
    if (rsvpErr) throw rsvpErr

    const upcomingEvents = (rsvps ?? [])
      .map((r: any) => r.community_events)
      .filter((e: any) => e && e.status === 'upcoming')

    res.status(200).json({
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      displayName: profile.display_name,
      bio: profile.bio,
      roleTitle: profile.role_title,
      status: profile.status,
      joinedAt: profile.joined_at,
      upcomingEvents,
    })
  } catch (error) {
    console.error('me/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
