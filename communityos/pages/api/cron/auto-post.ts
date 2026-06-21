import { NextApiRequest, NextApiResponse } from 'next'
import { rejectUnauthorizedCron } from '@/lib/cron-auth'
import { getCommunity } from '@/lib/communities'
import { listEvents } from '@/lib/events'
import { listPlans } from '@/lib/memberships'
import { listProducts } from '@/lib/payments'
import {
  botUsernameFromEnv,
  deepLinkForTarget,
  eventShareCaption,
  getConnectedChatInfo,
  planShareCaption,
  productShareCaption,
  resolveShareTarget,
  sendShareMessage,
} from '@/lib/share-content'
import { centsToStars } from '@/lib/star-rate'
import { sb, supabase } from '@/lib/supabase'

interface ScheduledPostRow {
  id: number
  community_id: number
  target_type: 'plan' | 'product' | 'event'
  target_id: number
  interval_hours: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (rejectUnauthorizedCron(req, res)) return

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const botUsername = botUsernameFromEnv()
  if (!botToken || !botUsername) {
    return res.status(200).json({ ok: false, setupRequired: true, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME not configured' })
  }

  try {
    const { data: due, error } = await sb
      .from('scheduled_posts')
      .select('id, community_id, target_type, target_id, interval_hours')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
    if (error) throw error

    let sent = 0
    const failures: Array<{ id: number; error: string }> = []

    for (const post of (due ?? []) as ScheduledPostRow[]) {
      try {
        const community = await getCommunity(post.community_id)
        if (!community) continue

        const chatInfo = await getConnectedChatInfo(post.community_id, community.telegram_chat_id ?? null)

        let caption: string | null = null
        let buttonText = 'Open CommunityOS'
        if (post.target_type === 'plan') {
          const plan = (await listPlans(post.community_id)).find((row) => row.id === post.target_id)
          if (!plan) continue
          caption = planShareCaption(community.name, plan, centsToStars(plan.price_cents ?? 0), chatInfo)
          buttonText = 'Subscribe'
        } else if (post.target_type === 'product') {
          const product = (await listProducts(post.community_id)).find((row) => row.id === post.target_id)
          if (!product) continue
          caption = productShareCaption(community.name, product, chatInfo)
          buttonText = product.buttonText || 'Buy'
        } else {
          const event = (await listEvents(post.community_id)).find((row) => row.id === post.target_id)
          if (!event) continue
          caption = eventShareCaption(community.name, event, chatInfo)
          buttonText = event.priceStars ? 'Get Ticket' : 'Register'
        }

        const { chatId: targetChatId } = await resolveShareTarget(post.community_id, community.owner_id)
        if (!targetChatId) continue

        const deepLink = deepLinkForTarget(botUsername, post.community_id, post.target_type, post.target_id)
        await sendShareMessage({
          botToken,
          chatId: targetChatId,
          caption,
          buttonText,
          deepLink,
          photoFileId: chatInfo?.photoFileId,
        })

        await supabase.from('community_activity_events').insert({
          community_id: post.community_id,
          user_id: community.owner_id,
          event_type: `${post.target_type}_shared`,
          title: 'Auto-posted to Telegram',
          metadata: { targetType: post.target_type, targetId: post.target_id, scheduledPostId: post.id, auto: true },
        })

        const nextRunAt = new Date(Date.now() + post.interval_hours * 60 * 60 * 1000).toISOString()
        await sb.from('scheduled_posts').update({ next_run_at: nextRunAt }).eq('id', post.id)
        sent += 1
      } catch (err: any) {
        console.error('cron/auto-post failed for scheduled_post', post.id, err)
        failures.push({ id: post.id, error: err?.message || 'unknown error' })
      }
    }

    res.status(200).json({ ok: true, sent, failed: failures.length, failures })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'PGRST205'
    ) {
      return res.status(200).json({ ok: false, setupRequired: true, error: 'CommunityOS database migration has not been applied yet.' })
    }
    console.error('cron/auto-post error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
