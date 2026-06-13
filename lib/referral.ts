import { supabase } from './supabase'
import { creditPoints, creditCoins } from './ledger'
import { REFERRAL_COIN_BONUS } from './coins'

const REFERRAL_ACTIVATION_BONUS = 500
const DOWNLINE_OVERRIDE_RATE = 0.05

/**
 * Creates a pending referral for a newly-created user, if `referrerTelegramId`
 * resolves to a real (different) user and no referral already exists for the
 * referee. No-op otherwise. Called from both the bot /start flow and the Mini
 * App's initData `start_param`, so referral attribution works regardless of
 * which entry point the invitee used.
 */
export async function createPendingReferral(refereeId: number, referrerTelegramId: number) {
  const { data: referrer } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', referrerTelegramId)
    .maybeSingle()
  if (!referrer || referrer.id === refereeId) return

  const { data: existing } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', refereeId)
    .maybeSingle()
  if (existing) return

  await supabase.from('referrals').insert({ referrer_id: referrer.id, referee_id: refereeId, status: 'pending' })
}

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
  await creditCoins(referral.referrer_id, REFERRAL_COIN_BONUS, 'referral_bonus')
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
