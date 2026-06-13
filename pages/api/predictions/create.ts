import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import { adjustTickets, creditPoints, getUserBalance, getPerkBalance, consumePerk } from '@/lib/ledger'
import { isDemoMode } from '@/lib/demo'
import { CONFIDENCE_BOOST_MAX_STAKE } from '@/lib/coins'
import { recordQuestProgress } from '@/lib/quests'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { sendMilestoneCelebration, sendQuestCompletedCelebration } from '@/lib/marketing'

const MAX_CONFIDENCE_STAKE = 500

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { roundId, side, confidence = 0 } = req.body ?? {}

  if (typeof roundId !== 'number' || (side !== 'UP' && side !== 'DOWN')) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  if (typeof confidence !== 'number' || confidence < 0 || confidence > CONFIDENCE_BOOST_MAX_STAKE) {
    return res.status(400).json({ error: `Confidence must be between 0 and ${CONFIDENCE_BOOST_MAX_STAKE}` })
  }

  if (isDemoMode()) return res.status(201).json({ ok: true })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('id, state, asset')
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

    let usedConfidenceBoost = false
    if (confidence > MAX_CONFIDENCE_STAKE) {
      const boosts = await getPerkBalance(userId, 'confidence_boost')
      if (boosts <= 0) {
        return res.status(400).json({ error: `Confidence must be between 0 and ${MAX_CONFIDENCE_STAKE} (use a confidence boost to stake more)` })
      }
      usedConfidenceBoost = true
    }

    const { error: insertErr } = await supabase.from('predictions').insert({
      round_id: roundId,
      user_id: userId,
      side,
      confidence,
    })
    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ error: 'You already predicted this round' })
      }
      throw insertErr
    }

    if (usedConfidenceBoost) {
      await consumePerk(userId, 'confidence_boost', roundId)
    }
    await adjustTickets(userId, -1, 'prediction')
    if (confidence > 0) {
      await creditPoints(userId, -confidence, 'stake', { refRound: roundId })
    }

    const completedQuests = [
      ...(await recordQuestProgress(userId, 'vote_count', 1)),
      ...(await recordQuestProgress(userId, 'asset_vote', 1, { asset: round.asset })),
    ]
    const newlyUnlocked = await checkAndUnlockAchievements(userId, { event: 'vote_cast' })

    if (completedQuests.length > 0 || newlyUnlocked.length > 0) {
      const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).single()
      if (user?.telegram_id) {
        for (const achievement of newlyUnlocked) {
          await sendMilestoneCelebration(user.telegram_id, achievement)
        }
        for (const quest of completedQuests) {
          await sendQuestCompletedCelebration(user.telegram_id, quest.title)
        }
      }
    }

    res.status(201).json({ ok: true })
  } catch (error) {
    console.error('predictions/create error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
