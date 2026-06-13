import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isDemoMode } from '@/lib/demo'
import { claimQuestReward } from '@/lib/quests'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { questId } = req.body ?? {}
  if (typeof questId !== 'number') return res.status(400).json({ error: 'Invalid request' })

  if (isDemoMode()) return res.status(200).json({ ok: true })

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    await claimQuestReward(userId, questId)
    res.status(200).json({ ok: true })
  } catch (error: any) {
    if (error?.message === 'Quest not completed' || error?.message === 'Quest already claimed') {
      return res.status(400).json({ error: error.message })
    }
    console.error('quests/claim error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
