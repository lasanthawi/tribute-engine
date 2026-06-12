import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { adjustTickets, creditPoints, getUserBalance } from '@/lib/ledger'
import { isDemoMode } from '@/lib/demo'

const MAX_CONFIDENCE_STAKE = 500

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { roundId, side, confidence = 0 } = req.body ?? {}

  if (typeof roundId !== 'number' || (side !== 'UP' && side !== 'DOWN')) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > MAX_CONFIDENCE_STAKE) {
    return res.status(400).json({ error: `Confidence must be between 0 and ${MAX_CONFIDENCE_STAKE}` })
  }

  if (isDemoMode()) return res.status(201).json({ ok: true })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('id, state')
      .eq('id', roundId)
      .maybeSingle()
    if (roundErr) throw roundErr
    if (!round || round.state !== 'OPEN') {
      return res.status(400).json({ error: 'Round is not open for predictions' })
    }

    const { data: existing } = await supabase
      .from('predictions')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) return res.status(409).json({ error: 'You already predicted this round' })

    const balance = await getUserBalance(userId)
    if (balance.tickets < 1) return res.status(400).json({ error: 'No tickets remaining' })
    if (confidence > balance.points) return res.status(400).json({ error: 'Not enough points to stake' })

    const { error: insertErr } = await supabase.from('predictions').insert({
      round_id: roundId,
      user_id: userId,
      side,
      confidence,
    })
    if (insertErr) throw insertErr

    await adjustTickets(userId, -1, 'prediction')
    if (confidence > 0) {
      await creditPoints(userId, -confidence, 'stake', { refRound: roundId })
    }

    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('predictions/create error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
