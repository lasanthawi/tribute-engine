import { sb } from './supabase'

export type EventType = 'webinar' | 'meetup' | 'challenge' | 'ama'

export interface CreateEventInput {
  title: string
  type?: EventType
  startsAt?: string
  priceStars?: number
}

export async function listEvents(communityId: number) {
  const { data: events, error } = await sb
    .from('community_events')
    .select('*')
    .eq('community_id', communityId)
    .order('starts_at', { ascending: true })
  if (error) throw error

  const ids = (events ?? []).map((e: any) => e.id)
  const { data: regs } = ids.length
    ? await sb.from('event_registrations').select('event_id').in('event_id', ids)
    : { data: [] }

  const counts = new Map<number, number>()
  for (const row of regs ?? []) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1)

  return (events ?? []).map((event: any) => ({
    id: event.id,
    title: event.title,
    type: event.event_type as EventType,
    startsAt: event.starts_at,
    registrations: counts.get(event.id) ?? 0,
    priceStars: event.price_stars,
  }))
}

export async function createEvent(communityId: number, input: CreateEventInput) {
  const { data, error } = await sb
    .from('community_events')
    .insert({
      community_id: communityId,
      title: input.title,
      event_type: input.type ?? 'webinar',
      starts_at: input.startsAt ?? new Date().toISOString(),
      price_stars: Math.max(0, Math.round(input.priceStars ?? 0)),
      status: 'active',
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.event_type as EventType,
    startsAt: data.starts_at,
    registrations: 0,
    priceStars: data.price_stars,
  }
}
