import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single()
    if (userErr) throw userErr

    const { data: referrals, error: refErr } = await supabase
      .from('referrals')
      .select('status')
      .eq('referrer_id', userId)
    if (refErr) throw refErr

    const activatedCount = (referrals ?? []).filter((r) => r.status === 'activated').length
    const pendingCount = (referrals ?? []).filter((r) => r.status === 'pending').length

    const { data: overrideEntries, error: overrideErr } = await supabase
      .from('points_ledger')
      .select('delta')
      .eq('user_id', userId)
      .eq('entry_type', 'referral_override')
    if (overrideErr) throw overrideErr

    const overrideEarned = (overrideEntries ?? []).reduce((sum, e) => sum + e.delta, 0)

    const botUsername = process.env.TELEGRAM_BOT_USERNAME
    const link = botUsername
      ? `https://t.me/${botUsername}?start=ref_${user.telegram_id}`
      : null

    res.status(200).json({
      link,
      referralCode: `ref_${user.telegram_id}`,
      activatedCount,
      pendingCount,
      overrideEarned,
    })
  } catch (error) {
    console.error('referral/info error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
