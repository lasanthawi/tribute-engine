import { sb } from './supabase'
import type { ReferralCampaignDto } from './api-client'

export interface CreateCampaignInput {
  title: string
  reward?: string
  status?: 'draft' | 'active' | 'paused'
}

export async function listReferralCampaigns(communityId: number): Promise<ReferralCampaignDto[]> {
  const { data, error } = await sb
    .from('referral_campaigns')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    reward: row.reward,
    status: row.status as ReferralCampaignDto['status'],
    clicks: row.clicks,
    joins: row.joins,
    purchases: row.purchases,
    revenueCents: row.revenue_cents,
  }))
}

export async function createReferralCampaign(communityId: number, input: CreateCampaignInput): Promise<ReferralCampaignDto> {
  const { data, error } = await sb
    .from('referral_campaigns')
    .insert({
      community_id: communityId,
      title: input.title,
      reward: input.reward ?? '',
      status: input.status ?? 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    reward: data.reward,
    status: data.status,
    clicks: data.clicks,
    joins: data.joins,
    purchases: data.purchases,
    revenueCents: data.revenue_cents,
  }
}
