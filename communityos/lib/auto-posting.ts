import { sb } from './supabase'

export interface ScheduledPostRow {
  id: number
  communityId: number
  targetType: 'plan' | 'product' | 'event'
  targetId: number
  intervalHours: number
  nextRunAt: string
  status: 'active' | 'paused'
}

function mapRow(row: any): ScheduledPostRow {
  return {
    id: row.id,
    communityId: row.community_id,
    targetType: row.target_type,
    targetId: row.target_id,
    intervalHours: row.interval_hours,
    nextRunAt: row.next_run_at,
    status: row.status,
  }
}

export async function listScheduledPosts(communityId: number): Promise<ScheduledPostRow[]> {
  const { data, error } = await sb.from('scheduled_posts').select('*').eq('community_id', communityId).order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function activateScheduledPost(
  communityId: number,
  targetType: 'plan' | 'product' | 'event',
  targetId: number,
  intervalHours: number
): Promise<ScheduledPostRow> {
  const nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString()
  const { data, error } = await sb
    .from('scheduled_posts')
    .upsert(
      { community_id: communityId, target_type: targetType, target_id: targetId, interval_hours: intervalHours, next_run_at: nextRunAt, status: 'active' },
      { onConflict: 'community_id,target_type,target_id' }
    )
    .select('*')
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function pauseScheduledPost(communityId: number, targetType: 'plan' | 'product' | 'event', targetId: number): Promise<ScheduledPostRow | null> {
  const { data, error } = await sb
    .from('scheduled_posts')
    .update({ status: 'paused' })
    .eq('community_id', communityId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}
