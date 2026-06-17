import { CommunityReferralRow, sb, supabase, UserRow } from './supabase'
import { creditCommunityXp } from './xp'

export function referralCode(communityId: number, userId: number): string {
  return `co_${communityId}_${userId}`
}

export function parseReferralCode(code: string): { communityId: number; referrerId: number } | null {
  const match = /^co_(\d+)_(\d+)$/.exec(code.trim())
  if (!match) return null
  return { communityId: Number(match[1]), referrerId: Number(match[2]) }
}

export function referralLink(communityId: number, userId: number): string | null {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) return null
  return `https://t.me/${botUsername}?start=${referralCode(communityId, userId)}`
}

async function ensureReferralRow(communityId: number, referrerId: number): Promise<CommunityReferralRow> {
  const code = referralCode(communityId, referrerId)
  const { data: existing, error } = await supabase
    .from('community_referrals')
    .select('*')
    .eq('community_id', communityId)
    .eq('referral_code', code)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing as CommunityReferralRow

  const { data, error: insertErr } = await supabase
    .from('community_referrals')
    .insert({ community_id: communityId, referrer_id: referrerId, referral_code: code, clicks: 0, status: 'clicked' })
    .select('*')
    .single()
  if (insertErr) throw insertErr
  return data as CommunityReferralRow
}

export async function recordReferralClick(communityId: number, referrerId: number, telegramUserId?: string) {
  const referral = await ensureReferralRow(communityId, referrerId)
  await supabase
    .from('community_referrals')
    .update({ clicks: referral.clicks + 1 })
    .eq('id', referral.id)

  await sb.from('referral_clicks').insert({
    community_id: communityId,
    referral_id: referral.id,
    referral_code: referral.referral_code,
    telegram_user_id: telegramUserId ?? null,
  })

  return referral
}

// Records a click straight from a `/start` referral code payload.
export async function recordClickByCode(code: string, telegramUserId?: string) {
  const parsed = parseReferralCode(code)
  if (!parsed) return null
  return recordReferralClick(parsed.communityId, parsed.referrerId, telegramUserId)
}

// Attributes a newly-joined user to the referrer encoded in `code`.
export async function registerReferredJoin(code: string, refereeId: number) {
  const parsed = parseReferralCode(code)
  if (!parsed) return null
  const { communityId, referrerId } = parsed
  if (referrerId === refereeId) return null

  const referral = await ensureReferralRow(communityId, referrerId)

  await supabase
    .from('community_referrals')
    .update({ referee_id: refereeId, status: referral.status === 'purchased' ? 'purchased' : 'joined' })
    .eq('id', referral.id)

  await sb.from('referral_attributions').insert({
    community_id: communityId,
    referral_id: referral.id,
    referred_user_id: refereeId,
    attribution_type: 'join',
  })

  await creditCommunityXp(communityId, referrerId, 50, 'referral_join', { refUser: refereeId })
  return referral
}

export async function activateCommunityReferral(communityId: number, referrerId: number, refereeId: number) {
  const referral = await ensureReferralRow(communityId, referrerId)
  await supabase
    .from('community_referrals')
    .update({ referee_id: refereeId, status: 'activated', activated_at: new Date().toISOString() })
    .eq('id', referral.id)

  await creditCommunityXp(communityId, referrerId, 75, 'referral_activated', { refUser: refereeId })
}

export async function listReferrals(communityId: number) {
  const { data: refs, error } = await supabase
    .from('community_referrals')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const referralRows = (refs ?? []) as CommunityReferralRow[]
  const referralIds = referralRows.map((ref) => ref.id)

  const { data: attributions } = referralIds.length
    ? await sb.from('referral_attributions').select('referral_id, attribution_type').in('referral_id', referralIds)
    : { data: [] }
  const { data: revenue } = referralIds.length
    ? await sb.from('revenue_attributions').select('referral_id, revenue_cents').in('referral_id', referralIds)
    : { data: [] }

  const joinMap = new Map<number, number>()
  for (const row of attributions ?? []) {
    if (row.attribution_type === 'join') joinMap.set(row.referral_id, (joinMap.get(row.referral_id) ?? 0) + 1)
  }
  const purchaseMap = new Map<number, number>()
  const revenueMap = new Map<number, number>()
  for (const row of revenue ?? []) {
    purchaseMap.set(row.referral_id, (purchaseMap.get(row.referral_id) ?? 0) + 1)
    revenueMap.set(row.referral_id, (revenueMap.get(row.referral_id) ?? 0) + row.revenue_cents)
  }

  const userIds = Array.from(new Set(referralRows.map((ref) => ref.referrer_id)))
  const { data: users, error: userErr } = userIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', userIds)
    : { data: [] as { id: number; username: string | null; telegram_id: number }[], error: null }
  if (userErr) throw userErr

  const userRows = (users ?? []) as Pick<UserRow, 'id' | 'username' | 'telegram_id'>[]
  const userMap = new Map(userRows.map((user) => [user.id, user]))

  return referralRows.map((ref) => {
    const user = userMap.get(ref.referrer_id)
    return {
      id: ref.id,
      referrer: user?.username ?? `member_${user?.telegram_id ?? ref.referrer_id}`,
      referralCode: ref.referral_code,
      status: ref.status,
      clicks: ref.clicks,
      invites: ref.clicks,
      joins: joinMap.get(ref.id) ?? 0,
      purchases: purchaseMap.get(ref.id) ?? 0,
      revenueCents: revenueMap.get(ref.id) ?? ref.revenue_cents,
    }
  })
}
