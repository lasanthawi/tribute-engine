import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { cancelMemberSubscription, listMemberSubscriptions } from '@/lib/memberships'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.communityId)
  if (!Number.isFinite(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ subscriptions: await listMemberSubscriptions(communityId, userId) })
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action ?? '')
      const subscriptionId = Number(req.body?.subscriptionId)
      if (!Number.isFinite(subscriptionId)) return res.status(400).json({ error: 'subscriptionId is required' })

      if (action === 'cancel') {
        const subscription = await cancelMemberSubscription(communityId, userId, subscriptionId)
        return res.status(200).json({ ok: true, subscription })
      }

      return res.status(400).json({ error: 'Unsupported subscription action' })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('member/[communityId]/subscriptions error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
