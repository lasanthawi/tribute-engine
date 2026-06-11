import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data, error } = await supabase
      .from('predictions')
      .select(
        `id, side, confidence, is_correct, points_earned, created_at,
         rounds ( id, asset, kind, state, strike, close, outcome, resolve_at )`
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const calls = (data ?? []).map((row: any) => ({
      id: row.id,
      side: row.side,
      confidence: row.confidence,
      isCorrect: row.is_correct,
      pointsEarned: row.points_earned,
      createdAt: row.created_at,
      round: row.rounds,
    }))

    const pending = calls.filter((c) => c.round?.state !== 'SETTLED' && c.round?.state !== 'VOIDED')
    const settled = calls.filter((c) => c.round?.state === 'SETTLED' || c.round?.state === 'VOIDED')

    res.status(200).json({ pending, settled })
  } catch (error) {
    console.error('me/calls error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
