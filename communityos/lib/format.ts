export function initials(value: string) {
  return value
    .split(/[\s_@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CO'
}

export function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Picks the most relevant item from a list ordered by something other than recency
// (e.g. price or id) — prefers an active item over just taking the first one.
export function pickPrimary<T extends { status?: string }>(items: T[]): T | null {
  return items.find((item) => item.status === 'active') ?? items[0] ?? null
}
