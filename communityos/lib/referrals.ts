import { CommunityReferralRow, supabase, UserRow } from './supabase'
import { creditCommunityXp } from './xp'

export function referralCode(communityId: number, userId: number): string {
  return `co_${communityId}_${userId}`
}

export function referralLink(communityId: number, userId: number): string | null {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  if (!botUsername) return null
  return `https://t.me/${botUsername}?start=${referralCode(communityId, userId)}`
}

export async function recordReferralClick(communityId: number, referrerId: number) {
  const code = referralCode(communityId, referrerId)
  const { data: existing, error: existingErr } = await supabase
    .from('community_referrals')
    .select('*')
    .eq('community_id', communityId)
    .eq('referral_code', code)
    .maybeSingle()
  if (existingErr) throw existingErr

  const existingReferral = existing as CommunityReferralRow | null

  if (existingReferral) {
    const { error } = await supabase
      .from('community_referrals')
      .update({ clicks: existingReferral.clicks + 1 })
      .eq('id', existingReferral.id)
    if (error) throw error
    return existingReferral
  }

  const { data, error } = await supabase
    .from('community_referrals')
    .insert({ community_id: communityId, referrer_id: referrerId, referral_code: code, clicks: 1, status: 'clicked' })
    .select('*')
    .single()
  if (error) throw error
  return data as CommunityReferralRow
}

export async function activateCommunityReferral(communityId: number, referrerId: number, refereeId: number) {
  const code = referralCode(communityId, referrerId)
  await recordReferralClick(communityId, referrerId)
  const { error } = await supabase
    .from('community_referrals')
    .update({ referee_id: refereeId, status: 'activated', activated_at: new Date().toISOString() })
    .eq('community_id', communityId)
    .eq('referral_code', code)
  if (error) throw error

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
      revenueCents: ref.revenue_cents,
    }
  })
}
