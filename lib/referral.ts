import { supabase } from './supabase'
import { creditPoints } from './ledger'

const REFERRAL_ACTIVATION_BONUS = 500
const DOWNLINE_OVERRIDE_RATE = 0.05

/**
 * On a referee's FIRST correct call, activate the referral and pay the
 * referrer a one-time bonus. No-op if there's no pending referral.
 * Returns true if a referral was activated.
 */
export async function activateReferralIfPending(refereeId: number): Promise<boolean> {
  const { data: referral, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, status')
    .eq('referee_id', refereeId)
    .eq('status', 'pending')
    .maybeSingle()
  if (error) throw error
  if (!referral) return false

  await supabase
    .from('referrals')
    .update({ status: 'activated', activated_at: new Date().toISOString() })
    .eq('id', referral.id)

  await creditPoints(referral.referrer_id, REFERRAL_ACTIVATION_BONUS, 'referral_bonus', {
    refUser: refereeId,
  })
  return true
}

/**
 * While a referral is activated, the referrer earns 5% of the referee's
 * earned points on every settled win — passive, ongoing.
 */
export async function applyDownlineOverride(refereeId: number, pointsEarned: number): Promise<void> {
  if (pointsEarned <= 0) return

  const { data: referral, error } = await supabase
    .from('referrals')
    .select('referrer_id, status')
    .eq('referee_id', refereeId)
    .eq('status', 'activated')
    .maybeSingle()
  if (error) throw error
  if (!referral) return

  const overridePoints = Math.floor(pointsEarned * DOWNLINE_OVERRIDE_RATE)
  if (overridePoints <= 0) return

  await creditPoints(referral.referrer_id, overridePoints, 'referral_override', {
    refUser: refereeId,
  })
}
