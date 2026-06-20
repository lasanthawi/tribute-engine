import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { requireCommunityOwner } from '@/lib/communities'
import { archivePlan, createPlan, listPlans } from '@/lib/memberships'
import { centsToStars } from '@/lib/star-rate'

interface PlanRow {
  id: number
  name: string
  description: string | null
  price_cents?: number
  priceCents?: number
  currency: string
  interval: string
  status: string
  subscribers?: number
}

function toDto(plan: PlanRow) {
  const priceCents = plan.price_cents ?? plan.priceCents ?? 0
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceCents,
    stars: centsToStars(priceCents),
    currency: plan.currency,
    interval: plan.interval,
    status: plan.status,
    subscribers: plan.subscribers ?? 0,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const plans = await listPlans(communityId)
      return res.status(200).json({ plans: plans.map(toDto) })
    }

    if (req.method === 'POST') {
      const { name, description, priceCents, interval } = req.body ?? {}
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' })
      const plan = await createPlan(communityId, {
        name,
        description: typeof description === 'string' ? description : null,
        priceCents: typeof priceCents === 'number' ? priceCents : 0,
        interval: typeof interval === 'string' ? interval : 'month',
      })
      return res.status(201).json({ plan: toDto({ ...plan, subscribers: 0 }) })
    }

    if (req.method === 'DELETE') {
      const planId = Number(req.query.planId ?? req.body?.planId)
      if (!Number.isFinite(planId)) return res.status(400).json({ error: 'planId is required' })

      const plan = await archivePlan(communityId, planId)
      return res.status(200).json({ plan: toDto(plan), ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/plans error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
