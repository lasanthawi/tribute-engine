import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, requireCommunityOwner } from '@/lib/communities'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const { name, handle, description, telegramInviteUrl, settings } = req.body ?? {}
      const updates: Record<string, any> = {}

      if (typeof name === 'string' && name.trim()) updates.name = name.trim()
      if (typeof handle === 'string') updates.handle = handle.trim() || null
      if (typeof description === 'string') updates.description = description.trim() || null
      if (typeof telegramInviteUrl === 'string') updates.telegram_invite_url = telegramInviteUrl.trim() || null
      if (settings && typeof settings === 'object') {
        const current = await getCommunity(communityId)
        updates.settings = { ...(current?.settings ?? {}), ...settings }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'At least one field is required' })
      }

      const { data, error } = await supabase
        .from('communities')
        .update(updates as any)
        .eq('id', communityId)
        .select('*')
        .single()

      if (error) throw error

      return res.status(200).json({
        ok: true,
        community: {
          id: (data as any).id,
          name: (data as any).name,
          handle: (data as any).handle,
          description: (data as any).description,
          status: (data as any).status,
          settings: {
            starsCheckoutEnabled: (data as any).settings?.starsCheckoutEnabled !== false,
            notificationsEnabled: (data as any).settings?.notificationsEnabled !== false,
          },
        },
      })
    }

    res.setHeader('Allow', ['PATCH', 'PUT'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/profile error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
