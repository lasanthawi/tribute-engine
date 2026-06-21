import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getCommunity, requireCommunityOwner } from '@/lib/communities'
import { listProducts } from '@/lib/payments'
import { getConnectedChatInfo, resolveShareTarget, sendShareMessage } from '@/lib/share-content'
import { supabase } from '@/lib/supabase'

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

    const productId = Number(req.body?.productId)
    if (!Number.isFinite(productId)) return res.status(400).json({ error: 'productId is required' })

    const community = await getCommunity(communityId)
    if (!community) return res.status(404).json({ error: 'Community not found' })

    const product = (await listProducts(communityId)).find((item) => item.id === productId)
    if (!product) return res.status(404).json({ error: 'Product not found' })

    const { target, chatId: targetChatId } = await resolveShareTarget(communityId, userId)
    if (!targetChatId) return res.status(400).json({ error: 'No Telegram chat is available for sharing' })

    // web_app inline buttons only work in private chats; a `startapp` deep link
    // launches the Mini App directly from any chat type, with no bot-chat detour.
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim()
    if (!botUsername) return res.status(400).json({ error: 'TELEGRAM_BOT_USERNAME is not configured' })
    const deepLink = `https://t.me/${botUsername}?startapp=co_${communityId}_product_${product.id}`
    const buttonText = typeof req.body?.buttonText === 'string' && req.body.buttonText.trim() ? req.body.buttonText.trim() : product.buttonText || 'Buy'
    const chatInfo = await getConnectedChatInfo(communityId, community.telegram_chat_id ?? null)
    const text = [
      `<b>${escapeHtml(product.title)}</b>`,
      product.description ? escapeHtml(product.description) : null,
      product.priceStars ? `${product.priceStars} XTR` : 'Free',
      chatInfo ? `${escapeHtml(chatInfo.title)} · ${chatInfo.activeMembers} members` : null,
      `Tap below to get it from ${escapeHtml(community.name)}.`,
    ]
      .filter(Boolean)
      .join('\n\n')

    await sendShareMessage({
      botToken,
      chatId: targetChatId,
      caption: text,
      buttonText,
      deepLink,
      photoFileId: chatInfo?.photoFileId,
    })

    await supabase.from('community_activity_events').insert({
      community_id: communityId,
      user_id: userId,
      event_type: 'product_shared',
      title: `Shared ${product.title}`,
      metadata: { productId: product.id, targetChatId },
    })

    res.status(200).json({ ok: true, target, url: deepLink })
  } catch (error) {
    console.error('communities/[id]/products/share error:', error)
    if (error instanceof Error && error.message.startsWith('Telegram send')) {
      return res.status(502).json({ error: error.message })
    }
    res.status(500).json({ error: 'Internal error' })
  }
}
