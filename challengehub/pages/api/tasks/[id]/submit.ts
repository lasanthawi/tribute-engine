import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { getTask, submitTask, isFirstSubmission } from '@/lib/challenges'
import { activateReferralIfPending } from '@/lib/referral'
import { SubmissionEvidenceType } from '@/lib/supabase'

const VALID_EVIDENCE_TYPES: SubmissionEvidenceType[] = ['text', 'screenshot', 'link']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const taskId = Number(req.query.id)
  if (Number.isNaN(taskId)) return res.status(400).json({ error: 'Invalid task id' })

  const { evidenceType, evidenceContent } = req.body ?? {}
  const type: SubmissionEvidenceType = VALID_EVIDENCE_TYPES.includes(evidenceType) ? evidenceType : 'text'

  try {
    const task = await getTask(taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const wasFirst = await isFirstSubmission(userId)

    const { xpAwarded } = await submitTask(userId, taskId, type, evidenceContent ?? null)

    let referralActivated = false
    if (wasFirst) {
      referralActivated = await activateReferralIfPending(userId)
    }

    res.status(200).json({ ok: true, xpAwarded, referralActivated })
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Task already submitted' })
    }
    console.error('tasks/[id]/submit error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
