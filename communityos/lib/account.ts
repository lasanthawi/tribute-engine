import { getCommunityMetrics } from './analytics'
import { ensureCommunityAvatar } from './access-control'
import { signedAssetUrl } from './assets'
import { sb, supabase } from './supabase'
import { ensureUserAvatar } from './telegram-auth'
import type { CommunitySummaryDto, MeDto } from './api-client'
import type { CommunityRow } from './supabase'

async function toSummary(row: CommunityRow): Promise<CommunitySummaryDto> {
  const avatarPath = await ensureCommunityAvatar(row)
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    description: row.description,
    status: row.status,
    avatarUrl: await signedAssetUrl(avatarPath, 86400),
  }
}

export async function getAccountOverview(userId: number): Promise<Omit<MeDto, 'id' | 'username'>> {
  const { data: ownedRows, error: ownedErr } = await supabase
    .from('communities')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
  if (ownedErr) throw ownedErr

  const { data: memberRows, error: memberErr } = await supabase
    .from('community_members')
    .select('community_id, communities(*)')
    .eq('user_id', userId)
    .neq('role', 'owner')
  if (memberErr) throw memberErr

  const owned = (ownedRows ?? []) as CommunityRow[]
  const memberCommunities = ((memberRows ?? []) as any[])
    .map((row) => row.communities)
    .filter(Boolean) as CommunityRow[]

  const ownedMetrics = await Promise.all(owned.map((community) => getCommunityMetrics(community.id).catch(() => null)))
  const totalMembers = ownedMetrics.reduce((sum, metrics) => sum + (metrics?.members ?? 0), 0)
  const activeSubscriptions = ownedMetrics.reduce((sum, metrics) => sum + (metrics?.activeSubscriptions ?? 0), 0)
  const monthlyStars = ownedMetrics.reduce((sum, metrics) => sum + (metrics?.monthlyStars ?? 0), 0)
  const accessIssues = ownedMetrics.reduce((sum, metrics) => sum + (metrics?.accessIssues ?? 0), 0)

  const { data: balanceRows } = owned.length
    ? await sb
        .from('community_balance_ledger')
        .select('stars_delta')
        .in('community_id', owned.map((community) => community.id))
        .eq('status', 'available')
    : { data: [] }
  const balanceStars = (balanceRows ?? []).reduce((sum: number, row: any) => sum + (row.stars_delta ?? 0), 0)

  const { data: user } = await sb
    .from('users')
    .select('telegram_id, avatar_path, communityos_onboarded_at, communityos_last_revenue_model')
    .eq('id', userId)
    .maybeSingle()

  const avatarPath = user ? await ensureUserAvatar({ id: userId, avatar_path: user.avatar_path, telegram_id: user.telegram_id }) : null

  return {
    isFirstCommunityOSLogin: !user?.communityos_onboarded_at && owned.length === 0 && memberCommunities.length === 0,
    onboardedAt: user?.communityos_onboarded_at ?? null,
    lastRevenueModel: user?.communityos_last_revenue_model ?? null,
    avatarUrl: await signedAssetUrl(avatarPath, 86400),
    accountStats: {
      communities: owned.length,
      memberCommunities: memberCommunities.length,
      totalMembers,
      activeSubscriptions,
      monthlyStars,
      balanceStars,
      accessIssues,
    },
    communities: await Promise.all(owned.map(toSummary)),
    memberCommunities: await Promise.all(memberCommunities.map(toSummary)),
  }
}

export async function markCommunityOSOnboarded(userId: number, revenueModel?: string | null) {
  const update: Record<string, unknown> = {
    communityos_onboarded_at: new Date().toISOString(),
  }
  if (revenueModel) update.communityos_last_revenue_model = revenueModel
  const { error } = await sb.from('users').update(update).eq('id', userId)
  if (error) throw error
}
