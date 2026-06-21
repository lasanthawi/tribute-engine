import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { answerFaqQuestion, generateWeeklyReport, getAiManager, updateAiSettings } from '@/lib/ai'
import { requireCommunityOwner } from '@/lib/communities'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  const communityId = Number(req.query.id)
  if (Number.isNaN(communityId)) return res.status(400).json({ error: 'Invalid community id' })

  try {
    const allowed = await requireCommunityOwner(userId, communityId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      return res.status(200).json({ ai: await getAiManager(communityId) })
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const action = typeof body.action === 'string' ? body.action : 'report'

      if (action === 'ask') {
        const question = typeof body.question === 'string' ? body.question.trim() : ''
        if (!question) return res.status(400).json({ error: 'Question is required' })
        const answer = await answerFaqQuestion(communityId, question)
        return res.status(200).json({ answer })
      }

      if (action === 'update_settings') {
        await updateAiSettings(communityId, {
          faqEnabled: typeof body.faqEnabled === 'boolean' ? body.faqEnabled : undefined,
          welcomeEnabled: typeof body.welcomeEnabled === 'boolean' ? body.welcomeEnabled : undefined,
          reportsEnabled: typeof body.reportsEnabled === 'boolean' ? body.reportsEnabled : undefined,
          tone: typeof body.tone === 'string' ? body.tone : undefined,
        })
        const ai = await getAiManager(communityId)
        return res.status(200).json({ ok: true, settings: ai.settings })
      }

      const report = await generateWeeklyReport(communityId)
      return res.status(200).json({ ok: true, report })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('communities/[id]/ai error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
