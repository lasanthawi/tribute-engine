import { sb } from './supabase'
import type { ReferralCampaignDto } from './api-client'

export interface CreateCampaignInput {
  title: string
  reward?: string
  status?: 'draft' | 'active' | 'paused'
  threshold?: number
  metric?: 'joins' | 'purchases' | 'revenue'
  targetType?: 'plan' | 'product' | 'event'
  targetId?: number
}

function encodeReward(input: CreateCampaignInput) {
  return JSON.stringify({
    label: input.reward ?? 'Unlock reward',
    threshold: Math.max(1, Math.round(input.threshold ?? 3)),
    metric: input.metric ?? 'joins',
  })
}

function decodeReward(value: string | null | undefined) {
  if (!value) return { label: 'Unlock reward', threshold: 3, metric: 'joins' }
  try {
    const parsed = JSON.parse(value)
    return {
      label: String(parsed.label ?? 'Unlock reward'),
      threshold: Math.max(1, Number(parsed.threshold ?? 3)),
      metric: parsed.metric === 'purchases' || parsed.metric === 'revenue' ? parsed.metric : 'joins',
    }
  } catch {
    return { label: value, threshold: 3, metric: 'joins' }
  }
}

export async function listReferralCampaigns(communityId: number): Promise<ReferralCampaignDto[]> {
  const { data, error } = await sb
    .from('referral_campaigns')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => {
    const reward = decodeReward(row.reward)
    return {
      id: row.id,
      title: row.title,
      reward: reward.label,
      metric: reward.metric as ReferralCampaignDto['metric'],
      threshold: reward.threshold,
      status: row.status as ReferralCampaignDto['status'],
      clicks: row.clicks,
      joins: row.joins,
      purchases: row.purchases,
      revenueCents: row.revenue_cents,
      targetType: row.target_type ?? null,
      targetId: row.target_id ?? null,
    }
  })
}

export async function createReferralCampaign(communityId: number, input: CreateCampaignInput): Promise<ReferralCampaignDto> {
  const { data, error } = await sb
    .from('referral_campaigns')
    .insert({
      community_id: communityId,
      title: input.title,
      reward: encodeReward(input),
      status: input.status ?? 'active',
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    reward: decodeReward(data.reward).label,
    metric: decodeReward(data.reward).metric as ReferralCampaignDto['metric'],
    threshold: decodeReward(data.reward).threshold,
    status: data.status,
    clicks: data.clicks,
    joins: data.joins,
    purchases: data.purchases,
    revenueCents: data.revenue_cents,
    targetType: data.target_type ?? null,
    targetId: data.target_id ?? null,
  }
}

export async function getReferralCampaignProgress(communityId: number, userId: number) {
  const campaigns = await listReferralCampaigns(communityId)
  const { data: referrals } = await sb
    .from('community_referrals')
    .select('id, referral_code, clicks')
    .eq('community_id', communityId)
    .eq('referrer_id', userId)
  const referralIds = (referrals ?? []).map((row: any) => row.id)
  const { data: attributions } = referralIds.length
    ? await sb.from('referral_attributions').select('referral_id, attribution_type').in('referral_id', referralIds)
    : { data: [] }
  const { data: revenue } = referralIds.length
    ? await sb.from('revenue_attributions').select('referral_id, revenue_cents').in('referral_id', referralIds)
    : { data: [] }

  const joins = (attributions ?? []).filter((row: any) => row.attribution_type === 'join').length
  const purchases = (revenue ?? []).length
  const revenueCents = (revenue ?? []).reduce((sum: number, row: any) => sum + (row.revenue_cents ?? 0), 0)

  return campaigns.map((campaign) => {
    const row = (campaign as any)
    const metric = row.metric ?? 'joins'
    const threshold = row.threshold ?? 3
    const current = metric === 'purchases' ? purchases : metric === 'revenue' ? Math.floor(revenueCents / 100) : joins
    return {
      campaign,
      metric,
      threshold,
      current,
      claimable: current >= threshold,
    }
  })
}
