import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'
import { demoRounds } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json({ rounds: demoRounds() })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('id, asset, kind, state, open_at, lock_at, resolve_at, base_reward')
      .eq('state', 'OPEN')
      .order('lock_at', { ascending: true })
    if (error) throw error

    const roundIds = (rounds ?? []).map((r) => r.id)
    let myPredictions: Record<number, { side: string; confidence: number }> = {}

    if (roundIds.length > 0) {
      const { data: predictions, error: predErr } = await supabase
        .from('predictions')
        .select('round_id, side, confidence')
        .eq('user_id', userId)
        .in('round_id', roundIds)
      if (predErr) throw predErr

      myPredictions = Object.fromEntries(
        (predictions ?? []).map((p) => [p.round_id, { side: p.side, confidence: p.confidence }])
      )
    }

    res.status(200).json({
      rounds: (rounds ?? []).map((r) => ({ ...r, myPrediction: myPredictions[r.id] ?? null })),
    })
  } catch (error) {
    console.error('rounds/open error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
