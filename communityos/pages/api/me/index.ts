import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { listOwnedCommunities } from '@/lib/communities'
import { demoDashboard } from '@/lib/demo-data'
import { isDemoMode, supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  if (isDemoMode) {
    return res.status(200).json({ id: 1, username: 'deepa', communities: [demoDashboard.community] })
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single()
    if (error) throw error

    const communities = await listOwnedCommunities(userId)
    res.status(200).json({
      id: user.id,
      username: user.username,
      communities: communities.map((community) => ({
        id: community.id,
        name: community.name,
        handle: community.handle,
        description: community.description,
        status: community.status,
      })),
    })
  } catch (error) {
    console.error('me/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
