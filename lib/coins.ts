/** CALLED IT — coin economy constants and redemption rules. */

export interface CoinPackage {
  id: string
  coins: number
  stars: number
  label: string
  bonus?: string
}

/** Telegram Stars (XTR) → coins. Larger packs include a bonus. */
export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'starter', coins: 100, stars: 100, label: '100 coins' },
  { id: 'plus', coins: 550, stars: 500, label: '550 coins', bonus: '+10% bonus' },
  { id: 'pro', coins: 1200, stars: 1000, label: '1,200 coins', bonus: '+20% bonus' },
]

/** Coins → points redemption rate (1 coin = 10 points). */
export const COINS_TO_POINTS_RATE = 10

/** Coins cost for one extra ticket (vote). */
export const EXTRA_TICKET_COST = 50

/** Coins cost for a confidence-boost perk (raises the max stake for one vote). */
export const CONFIDENCE_BOOST_COST = 100
export const CONFIDENCE_BOOST_MAX_STAKE = 1000

/** Coins cost for a streak-freeze perk (protects your streak after one miss). */
export const STREAK_FREEZE_COST = 150

/** Coins awarded to the referrer when a referral activates. */
export const REFERRAL_COIN_BONUS = 50

export type RedeemOption = 'points' | 'ticket' | 'confidence_boost' | 'streak_freeze'

/** Minimum coins per redeem call for the variable-rate "points" option. */
export const MIN_POINTS_REDEEM = 10
