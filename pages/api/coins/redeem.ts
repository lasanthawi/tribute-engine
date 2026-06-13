import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { creditPoints, adjustTickets, debitCoins, grantPerk } from '@/lib/ledger'
import {
  COINS_TO_POINTS_RATE,
  EXTRA_TICKET_COST,
  CONFIDENCE_BOOST_COST,
  STREAK_FREEZE_COST,
  MIN_POINTS_REDEEM,
  RedeemOption,
} from '@/lib/coins'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { option, coins } = req.body ?? {}
  const validOptions: RedeemOption[] = ['points', 'ticket', 'confidence_boost', 'streak_freeze']
  if (!validOptions.includes(option)) return res.status(400).json({ error: 'Invalid redeem option' })

  if (isDemoMode()) return res.status(200).json({ ok: true })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    if (option === 'points') {
      const amount = Number(coins)
      if (!Number.isInteger(amount) || amount < MIN_POINTS_REDEEM) {
        return res.status(400).json({ error: `Enter at least ${MIN_POINTS_REDEEM} coins to redeem` })
      }
      const ok = await debitCoins(userId, amount, 'redeem_points')
      if (!ok) return res.status(400).json({ error: 'Not enough coins' })
      await creditPoints(userId, amount * COINS_TO_POINTS_RATE, 'coin_redeem')
      return res.status(200).json({ ok: true, pointsAwarded: amount * COINS_TO_POINTS_RATE })
    }

    if (option === 'ticket') {
      const ok = await debitCoins(userId, EXTRA_TICKET_COST, 'redeem_ticket')
      if (!ok) return res.status(400).json({ error: 'Not enough coins' })
      await adjustTickets(userId, 1, 'coin_redeem')
      return res.status(200).json({ ok: true })
    }

    if (option === 'confidence_boost') {
      const ok = await debitCoins(userId, CONFIDENCE_BOOST_COST, 'redeem_perk')
      if (!ok) return res.status(400).json({ error: 'Not enough coins' })
      await grantPerk(userId, 'confidence_boost')
      return res.status(200).json({ ok: true })
    }

    if (option === 'streak_freeze') {
      const ok = await debitCoins(userId, STREAK_FREEZE_COST, 'redeem_perk')
      if (!ok) return res.status(400).json({ error: 'Not enough coins' })
      await grantPerk(userId, 'streak_freeze')
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Invalid redeem option' })
  } catch (error) {
    console.error('coins/redeem error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
