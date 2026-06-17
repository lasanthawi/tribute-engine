import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'

function normalize(value: string) {
  return value.trim().replace(/^start=/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = normalize(String(req.method === 'POST' ? req.body?.code ?? '' : req.query.code ?? ''))
  const referral = demoDashboard.referrals.find((row) => row.referralCode === code)

  if (!code || !referral) {
    return res.status(404).json({ error: 'Referral not found' })
  }

  return res.status(200).json({
    referral,
    attribution: {
      code,
      status: 'click_recorded',
      message: 'Referral click can now be attributed to join, purchase, and revenue events.',
    },
  })
}
