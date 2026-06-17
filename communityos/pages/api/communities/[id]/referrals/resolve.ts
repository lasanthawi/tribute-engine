import { NextApiRequest, NextApiResponse } from 'next'
import { demoDashboard } from '@/lib/demo-data'
import { parseReferralCode, recordClickByCode } from '@/lib/referrals'
import { isDemoMode } from '@/lib/supabase'

function normalize(value: string) {
  return value.trim().replace(/^start=/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
}

// Public click tracker: resolves a referral code and records the click so it can
// be attributed to later join/purchase/revenue events.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = normalize(String(req.method === 'POST' ? req.body?.code ?? '' : req.query.code ?? ''))
  const parsed = parseReferralCode(code)
  if (!code || !parsed) return res.status(404).json({ error: 'Referral not found' })

  if (isDemoMode) {
    const referral = demoDashboard.referrals.find((row) => row.referralCode === code)
    return res.status(200).json({
      referral: referral ?? null,
      attribution: { code, status: 'click_recorded', message: 'Demo referral click recorded.' },
    })
  }

  try {
    const telegramUserId = typeof req.body?.telegramUserId === 'string' ? req.body.telegramUserId : undefined
    await recordClickByCode(code, telegramUserId)
    res.status(200).json({
      attribution: { code, status: 'click_recorded', message: 'Referral click recorded.' },
    })
  } catch (error) {
    console.error('communities/[id]/referrals/resolve error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
