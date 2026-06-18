import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getAccountOverview } from '@/lib/account'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: user, error } = await supabase.from('users').select('id, username').eq('id', userId).single()
    if (error) throw error

    const overview = await getAccountOverview(userId)
    res.status(200).json({
      id: user.id,
      username: user.username,
      ...overview,
    })
  } catch (error) {
    console.error('me/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
