import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, requireCommunityOwner } from '@/lib/communities'
import { listEvents } from '@/lib/events'
import { supabase } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function publicBaseUrl(req: NextApiRequest) {
  const configured = process.env.MINI_APP_URL || process.env.NEXT_PUBLIC_MINI_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host
  const protoHeader = req.headers['x-forwarded-proto'] || 'https'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
  return host ? `${proto}://${host}` : ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' })

    const eventId = Number(req.body?.eventId)
    if (!Number.isFinite(eventId)) return res.status(400).json({ error: 'eventId is required' })

    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    const event = (await listEvents(communityId)).find((item) => item.id === eventId)
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const { data: owner, error: ownerError } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle()
    if (ownerError) throw ownerError
    const targetChatId = community.telegram_chat_id ?? owner?.telegram_id
    if (!targetChatId) return res.status(400).json({ error: 'No Telegram chat is available for sharing' })

    // web_app inline buttons only work in private chats; a `startapp` deep link
    // launches the Mini App directly from any chat type, with no bot-chat detour.
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim()
    if (!botUsername) return res.status(400).json({ error: 'TELEGRAM_BOT_USERNAME is not configured' })
    const deepLink = `https://t.me/${botUsername}?startapp=co_${communityId}_event_${event.id}`
    const buttonText = typeof req.body?.buttonText === 'string' && req.body.buttonText.trim() ? req.body.buttonText.trim() : event.priceStars ? 'Get Ticket' : 'Register'
    const text = [
      `<b>${escapeHtml(event.title)}</b>`,
      event.description ? escapeHtml(event.description) : null,
      `${new Date(event.startsAt).toLocaleString()}${event.priceStars ? ` · ${event.priceStars} XTR` : ' · Free'}`,
      `Tap below to register for ${escapeHtml(community.name)}.`,
    ]
      .filter(Boolean)
      .join('\n\n')

    await sendTelegramMessage(botToken, targetChatId, text, 'HTML', {
      inline_keyboard: [[{ text: buttonText, url: deepLink }]],
    })

    await supabase.from('community_activity_events').insert({
      community_id: communityId,
      user_id: userId,
      event_type: 'event_shared',
      title: `Shared ${event.title}`,
      metadata: { eventId: event.id, targetChatId },
    })

    res.status(200).json({ ok: true, target: community.telegram_chat_id ? 'community_chat' : 'owner_chat', url: deepLink })
  } catch (error) {
    console.error('communities/[id]/events/share error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
