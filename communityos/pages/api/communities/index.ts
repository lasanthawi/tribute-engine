import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { signedAssetUrl } from '@/lib/assets'
import { createCommunity, listOwnedCommunities } from '@/lib/communities'

async function toDto(c: { id: number; name: string; handle: string | null; description: string | null; status: string; avatar_path?: string | null }) {
  return { id: c.id, name: c.name, handle: c.handle, description: c.description, status: c.status, avatarUrl: await signedAssetUrl(c.avatar_path, 86400) }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    if (req.method === 'GET') {
      const communities = await listOwnedCommunities(userId)
      return res.status(200).json({ communities: await Promise.all(communities.map(toDto)) })
    }

    if (req.method === 'POST') {
      const { name, handle, description, telegramChatId, telegramInviteUrl } = req.body ?? {}
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' })
      const community = await createCommunity(userId, {
        name,
        handle: typeof handle === 'string' ? handle : null,
        description: typeof description === 'string' ? description : null,
        telegramChatId: typeof telegramChatId === 'number' ? telegramChatId : null,
        telegramInviteUrl: typeof telegramInviteUrl === 'string' ? telegramInviteUrl : null,
      })
      return res.status(201).json({ community: await toDto(community) })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
