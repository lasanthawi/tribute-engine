import { sb } from './supabase'
import { signedAssetUrl } from './assets'

export type EventType = 'webinar' | 'meetup' | 'challenge' | 'ama'

export interface CreateEventInput {
  title: string
  type?: EventType
  startsAt?: string
  priceStars?: number
  description?: string
  coverPath?: string | null
  accessLink?: string
}

export async function listEvents(communityId: number, userId?: number) {
  const { data: events, error } = await sb
    .from('community_events')
    .select('*')
    .eq('community_id', communityId)
    .neq('status', 'archived')
    .order('starts_at', { ascending: true })
  if (error) throw error

  const ids = (events ?? []).map((e: any) => e.id)
  const { data: regs } = ids.length
    ? await sb.from('event_registrations').select('event_id').in('event_id', ids)
    : { data: [] }

  const counts = new Map<number, number>()
  for (const row of regs ?? []) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1)

  let registered = new Set<number>()
  if (userId && ids.length) {
    const { data: member } = await sb.from('community_members').select('id').eq('community_id', communityId).eq('user_id', userId).maybeSingle()
    if (member?.id) {
      const { data: userRegs } = await sb.from('event_registrations').select('event_id').eq('member_id', member.id).in('event_id', ids)
      registered = new Set((userRegs ?? []).map((row: any) => row.event_id))
    }
  }

  return Promise.all(
    (events ?? []).map(async (event: any) => {
      const metadata = event.metadata ?? {}
      const isRegistered = registered.has(event.id)
      return {
        id: event.id,
        title: event.title,
        type: event.event_type as EventType,
        description: metadata.description ?? null,
        startsAt: event.starts_at,
        registrations: counts.get(event.id) ?? 0,
        priceStars: event.price_stars,
        coverUrl: await signedAssetUrl(metadata.coverPath, 86400),
        accessLink: isRegistered ? metadata.accessLink ?? null : null,
        registered: isRegistered,
      }
    })
  )
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
      metadata: {
        description: input.description ?? '',
        coverPath: input.coverPath ?? null,
        accessLink: input.accessLink ?? '',
      },
    })
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.event_type as EventType,
    description: data.metadata?.description ?? null,
    startsAt: data.starts_at,
    registrations: 0,
    priceStars: data.price_stars,
    coverUrl: await signedAssetUrl(data.metadata?.coverPath, 86400),
    accessLink: null,
    registered: false,
  }
}

export async function archiveEvent(communityId: number, eventId: number) {
  const { data, error } = await sb
    .from('community_events')
    .update({ status: 'archived' })
    .eq('community_id', communityId)
    .eq('id', eventId)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: data.id,
    title: data.title,
    type: data.event_type as EventType,
    description: data.metadata?.description ?? null,
    startsAt: data.starts_at,
    registrations: 0,
    priceStars: data.price_stars,
    coverUrl: await signedAssetUrl(data.metadata?.coverPath, 86400),
    accessLink: null,
    registered: false,
  }
}

export async function registerEvent(communityId: number, userId: number, eventId: number) {
  const { data: event, error } = await sb
    .from('community_events')
    .select('*')
    .eq('community_id', communityId)
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  if (!event) return { ok: false as const, reason: 'Event not found' }
  if (event.price_stars > 0) return { ok: false as const, reason: 'Payment required' }

  const { data: member } = await sb.from('community_members').select('id').eq('community_id', communityId).eq('user_id', userId).maybeSingle()
  if (!member?.id) return { ok: false as const, reason: 'Member not found' }

  await sb.from('event_registrations').upsert(
    { event_id: eventId, member_id: member.id, status: 'registered' },
    { onConflict: 'event_id,member_id' }
  )

  await sb.from('community_activity_events').insert({
    community_id: communityId,
    user_id: userId,
    event_type: 'event_registered',
    title: `Registered for ${event.title}`,
    metadata: { eventId },
  })

  return { ok: true as const, eventId }
}
