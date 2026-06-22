import { sb, supabase } from './supabase'
import type { AiManagerDto, FaqEntryDto, HealthSignalDto, KnowledgeSourceDto, WeeklyReportDto } from './api-client'
import { generateAiText } from './ai-providers'

export async function getAiManager(communityId: number): Promise<AiManagerDto> {
  const [{ count: faqCount }, { data: report }, { data: score }, { data: suggestions }, { data: settings }] = await Promise.all([
    sb.from('ai_faq_entries').select('id', { count: 'exact', head: true }).eq('community_id', communityId).eq('status', 'active'),
    sb.from('weekly_reports').select('status').eq('community_id', communityId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('community_health_scores').select('score').eq('community_id', communityId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('ai_suggestions').select('*').eq('community_id', communityId).eq('status', 'open').order('created_at', { ascending: false }).limit(5),
    supabase.from('community_ai_settings').select('*').eq('community_id', communityId).maybeSingle(),
  ])

  const weeklyReportStatus =
    report?.status === 'ready' ? 'ready' : report?.status === 'scheduled' ? 'scheduled' : 'not_configured'
  const aiSettings = settings as any

  return {
    healthScore: score?.score ?? 0,
    weeklyReportStatus,
    faqCount: faqCount ?? 0,
    suggestions: ((suggestions ?? []) as any[]).map(
      (row): HealthSignalDto => ({ id: row.id, title: row.title, detail: row.detail ?? '', tone: 'info' })
    ),
    settings: {
      faqEnabled: aiSettings?.faq_enabled ?? true,
      welcomeEnabled: aiSettings?.welcome_enabled ?? true,
      reportsEnabled: aiSettings?.reports_enabled ?? true,
      tone: aiSettings?.tone ?? 'friendly',
    },
  }
}

export interface UpdateAiSettingsInput {
  faqEnabled?: boolean
  welcomeEnabled?: boolean
  reportsEnabled?: boolean
  tone?: string
}

export async function updateAiSettings(communityId: number, input: UpdateAiSettingsInput) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.faqEnabled !== undefined) updates.faq_enabled = input.faqEnabled
  if (input.welcomeEnabled !== undefined) updates.welcome_enabled = input.welcomeEnabled
  if (input.reportsEnabled !== undefined) updates.reports_enabled = input.reportsEnabled
  if (input.tone !== undefined) updates.tone = input.tone

  const { error } = await supabase
    .from('community_ai_settings')
    .upsert({ community_id: communityId, ...updates }, { onConflict: 'community_id' })
  if (error) throw error
}

// Generates a weekly report record summarising recent activity. Tries the
// configured AI gateway first; falls back to a templated summary if no
// provider is configured or every provider fails, so this never breaks.
export async function generateWeeklyReport(communityId: number) {
  const { count: activity } = await sb
    .from('community_activity_events')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)

  let summary = `Weekly report generated from ${activity ?? 0} recent activity events across members, access, payments, and referrals.`
  try {
    summary = await generateAiText(
      `Write a short, friendly weekly report for a Telegram community owner. There were ${activity ?? 0} recorded activity events (member joins, access grants, payments, referrals) in the past week. Summarize the activity level in 2-3 sentences and suggest one concrete next step. Keep it under 120 words and do not use markdown headings.`,
      { communityId }
    )
  } catch (error) {
    console.error('generateAiText failed for weekly report, using templated summary:', error)
  }

  const { data, error } = await sb
    .from('weekly_reports')
    .insert({ community_id: communityId, status: 'ready', summary, metrics: { activity: activity ?? 0 } })
    .select('*')
    .single()
  if (error) throw error
  return { status: 'ready' as const, summary: data.summary }
}

// Answers a member/owner question using the community's curated FAQ entries
// and knowledge sources as context. Does not persist the answer — the FAQ
// table stays owner-curated.
export async function answerFaqQuestion(communityId: number, question: string): Promise<string> {
  const [{ data: faqs }, { data: sources }] = await Promise.all([
    sb.from('ai_faq_entries').select('question, answer').eq('community_id', communityId).eq('status', 'active').limit(20),
    sb.from('ai_knowledge_sources').select('title, content').eq('community_id', communityId).eq('status', 'active').limit(10),
  ])

  const context = [
    ...((faqs ?? []) as { question: string; answer: string }[]).map((row) => `Q: ${row.question}\nA: ${row.answer}`),
    ...((sources ?? []) as { title: string; content: string | null }[]).map((row) => `${row.title}: ${row.content ?? ''}`),
  ].join('\n\n')

  const prompt = context
    ? `You are a helpful assistant for a Telegram community. Use the following context to answer the member's question. If the context does not cover it, say you are not sure and suggest contacting the community owner.\n\nContext:\n${context}\n\nQuestion: ${question}`
    : `You are a helpful assistant for a Telegram community. Answer the member's question as best you can, and say you are not sure if you do not know.\n\nQuestion: ${question}`

  return generateAiText(prompt, { communityId })
}

export async function listFaqEntries(communityId: number): Promise<FaqEntryDto[]> {
  const { data, error } = await sb
    .from('ai_faq_entries')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    status: row.status,
  }))
}

export async function createFaqEntry(communityId: number, input: { question: string; answer: string }): Promise<FaqEntryDto> {
  const { data, error } = await sb
    .from('ai_faq_entries')
    .insert({ community_id: communityId, question: input.question, answer: input.answer, status: 'active' })
    .select('*')
    .single()
  if (error) throw error
  return { id: data.id, question: data.question, answer: data.answer, status: data.status }
}

export async function deleteFaqEntry(communityId: number, faqId: number): Promise<void> {
  const { error } = await sb.from('ai_faq_entries').delete().eq('community_id', communityId).eq('id', faqId)
  if (error) throw error
}

export async function listKnowledgeSources(communityId: number): Promise<KnowledgeSourceDto[]> {
  const { data, error } = await sb
    .from('ai_knowledge_sources')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    content: row.content,
    status: row.status,
  }))
}

export async function createKnowledgeSource(
  communityId: number,
  input: { title: string; sourceType?: string; content?: string }
): Promise<KnowledgeSourceDto> {
  const { data, error } = await sb
    .from('ai_knowledge_sources')
    .insert({
      community_id: communityId,
      title: input.title,
      source_type: input.sourceType ?? 'note',
      content: input.content ?? null,
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return { id: data.id, title: data.title, sourceType: data.source_type, content: data.content, status: data.status }
}

export async function deleteKnowledgeSource(communityId: number, sourceId: number): Promise<void> {
  const { error } = await sb.from('ai_knowledge_sources').delete().eq('community_id', communityId).eq('id', sourceId)
  if (error) throw error
}

export async function listWeeklyReports(communityId: number, limit = 3): Promise<WeeklyReportDto[]> {
  const { data, error } = await sb
    .from('weekly_reports')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
  }))
}

export async function countAiRequestsThisMonth(communityId: number): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)
  const { count, error } = await sb
    .from('ai_request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .gte('created_at', startOfMonth.toISOString())
  if (error) throw error
  return count ?? 0
}
