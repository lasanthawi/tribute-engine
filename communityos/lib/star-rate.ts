// Telegram Stars are priced 1:1 in the invoice; we persist an approximate cash
// value so revenue rolls up alongside manual/fiat plans. ~1 Star ≈ $0.013.
// Zero imports: safe to use from both server lib/* and the client bundle (pages/index.tsx).
export const STAR_TO_CENTS = 1.3

export function starsToCents(stars: number): number {
  return Math.round(stars * STAR_TO_CENTS)
}

export function centsToStars(cents: number): number {
  return Math.round(cents / STAR_TO_CENTS)
}

export function formatUsdApprox(stars: number): string {
  const dollars = starsToCents(stars) / 100
  return `~$${dollars.toFixed(dollars < 10 ? 2 : 0)}`
}
