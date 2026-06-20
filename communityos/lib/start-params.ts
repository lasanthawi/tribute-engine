// Telegram `/start` and `startapp` payloads share the `co_` prefix across two distinct shapes.
// Zero imports: safe to use from both server lib/* and the client bundle (pages/index.tsx).

export interface OfferCode {
  communityId: number
  kind: 'plan' | 'product' | 'event'
  itemId: number
}

export interface ReferralCode {
  communityId: number
  referrerId: number
}

// co_{communityId}_{plan|product|event}_{itemId}
export function parseOfferCode(value: string): OfferCode | null {
  const match = /^co_(\d+)_(plan|product|event)_(\d+)$/.exec(value.trim())
  if (!match) return null
  return {
    communityId: Number(match[1]),
    kind: match[2] as 'plan' | 'product' | 'event',
    itemId: Number(match[3]),
  }
}

// co_{communityId}_{referrerId}
export function parseReferralCode(value: string): ReferralCode | null {
  const match = /^co_(\d+)_(\d+)$/.exec(value.trim())
  if (!match) return null
  return { communityId: Number(match[1]), referrerId: Number(match[2]) }
}
