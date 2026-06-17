import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      chats: demoDashboard.chats,
      queue: demoDashboard.members.filter((member) => member.accessStatus === 'pending' || member.accessStatus === 'failed'),
      logs: demoDashboard.accessLogs,
    })
  }

  if (req.method === 'POST') {
    const action = req.body?.action ?? 'sync'
    return res.status(200).json({
      ok: true,
      action,
      message:
        action === 'grant'
          ? 'Access grant queued for Telegram sync.'
          : action === 'revoke'
          ? 'Access revoke queued for Telegram sync.'
          : 'Access sync queued.',
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}
