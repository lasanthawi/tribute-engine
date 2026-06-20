import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, requireCommunityOwner } from '@/lib/communities'
import { listPlans } from '@/lib/memberships'
import { centsToStars } from '@/lib/star-rate'
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

    const planId = Number(req.body?.planId)
    if (!Number.isFinite(planId)) return res.status(400).json({ error: 'planId is required' })

    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    const plans = await listPlans(communityId)
    const plan = plans.find((item) => item.id === planId)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })

    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .maybeSingle()
    if (ownerError) throw ownerError

    const targetChatId = community.telegram_chat_id ?? owner?.telegram_id
    if (!targetChatId) return res.status(400).json({ error: 'No Telegram chat is available for sharing' })

    const baseUrl = publicBaseUrl(req)
    if (!baseUrl) return res.status(400).json({ error: 'MINI_APP_URL is not configured' })

    const subscribeUrl = `${baseUrl}/member/${communityId}?plan=${plan.id}`
    const buttonText = typeof req.body?.buttonText === 'string' && req.body.buttonText.trim() ? req.body.buttonText.trim() : 'Subscribe'
    const stars = centsToStars(plan.price_cents ?? 0)
    const text = [
      `<b>${escapeHtml(plan.name)}</b>`,
      plan.description ? escapeHtml(plan.description) : null,
      stars > 0 ? `${stars} XTR per ${escapeHtml(plan.interval)}` : null,
      `Open the card to subscribe to ${escapeHtml(community.name)}.`,
    ]
      .filter(Boolean)
      .join('\n\n')

    await sendTelegramMessage(botToken, targetChatId, text, 'HTML', {
      inline_keyboard: [[{ text: buttonText, web_app: { url: subscribeUrl } }]],
    })

    await supabase.from('community_activity_events').insert({
      community_id: communityId,
      user_id: userId,
      event_type: 'plan_shared',
      title: `Shared ${plan.name}`,
      metadata: { planId: plan.id, targetChatId },
    })

    res.status(200).json({
      ok: true,
      target: community.telegram_chat_id ? 'community_chat' : 'owner_chat',
      url: subscribeUrl,
    })
  } catch (error) {
    console.error('communities/[id]/plans/share error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
