import { CommunityMemberRow, CommunityRow, sb, supabase, UserRow } from './supabase'
import { creditCommunityXp, getCommunityXp, levelForXp } from './xp'

export interface CreateCommunityInput {
  name: string
  handle?: string | null
  description?: string | null
  telegramChatId?: number | null
  telegramInviteUrl?: string | null
}

export async function listOwnedCommunities(ownerId: number) {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CommunityRow[]
}

export async function createCommunity(ownerId: number, input: CreateCommunityInput) {
  const { data, error } = await supabase
    .from('communities')
    .insert({
      owner_id: ownerId,
      name: input.name,
      handle: input.handle ?? null,
      description: input.description ?? null,
      telegram_chat_id: input.telegramChatId ?? null,
      telegram_invite_url: input.telegramInviteUrl ?? null,
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error

  const community = data as CommunityRow

  await supabase.from('community_members').upsert(
    {
      community_id: community.id,
      user_id: ownerId,
      role: 'owner',
      access_status: 'granted',
      source: 'direct',
      last_active_at: new Date().toISOString(),
    },
    { onConflict: 'community_id,user_id' }
  )
  await supabase.from('community_ai_settings').upsert({ community_id: community.id }, { onConflict: 'community_id' })
  await creditCommunityXp(community.id, ownerId, 100, 'community_created')

  return community
}

export async function getCommunity(communityId: number) {
  const { data, error } = await supabase.from('communities').select('*').eq('id', communityId).maybeSingle()
  if (error) throw error
  return data as CommunityRow | null
}

export async function requireCommunityOwner(userId: number, communityId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('communities')
    .select('id')
    .eq('id', communityId)
    .eq('owner_id', userId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function ensureMember(
  communityId: number,
  userId: number,
  opts: { role?: 'owner' | 'admin' | 'member'; source?: string; accessStatus?: 'pending' | 'granted' | 'revoked' | 'expired' | 'failed' } = {}
) {
  const { data, error } = await supabase
    .from('community_members')
    .upsert(
      {
        community_id: communityId,
        user_id: userId,
        role: opts.role ?? 'member',
        source: opts.source ?? 'direct',
        access_status: opts.accessStatus ?? 'pending',
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'community_id,user_id' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data as CommunityMemberRow
}

export async function listMembers(communityId: number) {
  const { data: members, error } = await supabase
    .from('community_members')
    .select('*')
    .eq('community_id', communityId)
    .order('joined_at', { ascending: false })
  if (error) throw error

  const memberRows = (members ?? []) as CommunityMemberRow[]
  const userIds = memberRows.map((member) => member.user_id)
  const { data: users, error: usersErr } = userIds.length
    ? await supabase.from('users').select('id, username, telegram_id').in('id', userIds)
    : { data: [] as { id: number; username: string | null; telegram_id: number }[], error: null }
  if (usersErr) throw usersErr

  const { data: xpRows, error: xpErr } = userIds.length
    ? await supabase.from('community_xp_ledger').select('user_id, delta').eq('community_id', communityId).in('user_id', userIds)
    : { data: [] as { user_id: number; delta: number }[], error: null }
  if (xpErr) throw xpErr

  const { data: subs, error: subErr } = userIds.length
    ? await supabase
        .from('member_subscriptions')
        .select('user_id, status, plan_id')
        .eq('community_id', communityId)
        .in('user_id', userIds)
    : { data: [] as { user_id: number; status: string; plan_id: number | null }[], error: null }
  if (subErr) throw subErr

  const planIds = Array.from(new Set((subs ?? []).map((sub) => sub.plan_id).filter((id): id is number => typeof id === 'number')))
  const { data: plans, error: planErr } = planIds.length
    ? await supabase.from('membership_plans').select('id, name').in('id', planIds)
    : { data: [] as { id: number; name: string }[], error: null }
  if (planErr) throw planErr

  // Per-member revenue (paid Stars purchases) and referral counts.
  const { data: purchaseRows } = userIds.length
    ? await sb.from('purchases').select('buyer_user_id, amount_cents').eq('community_id', communityId).eq('status', 'paid').in('buyer_user_id', userIds)
    : { data: [] }
  const { data: referralRows } = userIds.length
    ? await sb.from('community_referrals').select('referrer_id').eq('community_id', communityId).in('referrer_id', userIds)
    : { data: [] }

  const revenueMap = new Map<number, number>()
  for (const row of purchaseRows ?? []) revenueMap.set(row.buyer_user_id, (revenueMap.get(row.buyer_user_id) ?? 0) + (row.amount_cents ?? 0))
  const referralCountMap = new Map<number, number>()
  for (const row of referralRows ?? []) referralCountMap.set(row.referrer_id, (referralCountMap.get(row.referrer_id) ?? 0) + 1)

  const userRows = (users ?? []) as Pick<UserRow, 'id' | 'username' | 'telegram_id'>[]
  const userMap = new Map(userRows.map((user) => [user.id, user]))
  const planMap = new Map((plans ?? []).map((plan) => [plan.id, plan.name]))
  const subMap = new Map((subs ?? []).map((sub) => [sub.user_id, sub]))
  const xpMap = new Map<number, number>()
  for (const row of xpRows ?? []) xpMap.set(row.user_id, (xpMap.get(row.user_id) ?? 0) + row.delta)

  return memberRows.map((member) => {
    const user = userMap.get(member.user_id)
    const subscription = subMap.get(member.user_id)
    const xp = xpMap.get(member.user_id) ?? 0
    return {
      id: member.user_id,
      username: user?.username ?? `member_${user?.telegram_id ?? member.user_id}`,
      role: member.role,
      accessStatus: member.access_status,
      source: member.source,
      xp,
      level: levelForXp(xp),
      subscriptionStatus: subscription?.status ?? 'none',
      planName: subscription?.plan_id ? planMap.get(subscription.plan_id) ?? null : null,
      joinedAt: member.joined_at,
      lastActiveAt: member.last_active_at,
      revenueCents: revenueMap.get(member.user_id) ?? 0,
      referralCount: referralCountMap.get(member.user_id) ?? 0,
    }
  })
}

export async function getMemberProfile(communityId: number, userId: number) {
  const member = await ensureMember(communityId, userId, { accessStatus: 'pending' })
  const { xp, level } = await getCommunityXp(communityId, userId)
  return { member, xp, level }
}
