import { sb } from './supabase'
import type { AiManagerDto, HealthSignalDto } from './api-client'

export async function getAiManager(communityId: number): Promise<AiManagerDto> {
  const [{ count: faqCount }, { data: report }, { data: score }, { data: suggestions }] = await Promise.all([
    sb.from('ai_faq_entries').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'active'),
    sb.from('weekly_reports').select('status').eq('community_id', communityId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('community_health_scores').select('score').eq('community_id', communityId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('ai_suggestions').select('*').eq('community_id', communityId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
  ])

  const weeklyReportStatus =
    report?.status === 'ready' ? 'ready' : report?.status === 'scheduled' ? 'scheduled' : 'not_configured'

  return {
    healthScore: score?.score ?? 0,
    weeklyReportStatus,
    faqCount: faqCount ?? 0,
    suggestions: ((suggestions ?? []) as any[]).map(
      (row): HealthSignalDto => ({ id: row.id, title: row.title, detail: row.detail ?? '', tone: 'info' })
    ),
  }
}

// Generates a lightweight weekly report record summarising recent activity.
// The narrative is templated for the beta; an LLM pass can replace `summary`.
export async function generateWeeklyReport(communityId: number) {
  const { count: activity } = await sb
    .from('community_activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)

  const summary = `Weekly report generated from ${activity ?? 0} recent activity events across members, access, payments, and referrals.`

  const { data, error } = await sb
    .from('weekly_reports')
    .insert({ community_id: communityId, status: 'ready', summary, metrics: { activity: activity ?? 0 } })
    .select('*')
    .single()
  if (error) throw error
  return { status: 'ready' as const, summary: data.summary }
}
