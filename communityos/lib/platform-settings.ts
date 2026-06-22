import { sb } from './supabase'

const SETTINGS_ID = 1
const DEFAULT_COMMISSION_RATE_BPS = 500

export async function getCommissionRateBps(): Promise<number> {
  const { data, error } = await sb.from('platform_settings').select('commission_rate_bps').eq('id', SETTINGS_ID).maybeSingle()
  if (error) throw error
  return data?.commission_rate_bps ?? DEFAULT_COMMISSION_RATE_BPS
}

export async function setCommissionRateBps(bps: number): Promise<number> {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    throw new Error('commissionRateBps must be an integer between 0 and 10000')
  }
  const { error } = await sb
    .from('platform_settings')
    .upsert({ id: SETTINGS_ID, commission_rate_bps: bps, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) throw error
  return bps
}

export function splitCommission(grossStars: number, commissionRateBps: number) {
  const commissionStars = Math.round((grossStars * commissionRateBps) / 10000)
  return { grossStars, commissionStars, netStars: grossStars - commissionStars }
}

export async function getPlatformCommissionTotals(): Promise<{ totalCommissionStars: number; totalCommissionCents: number }> {
  const { data, error } = await sb.from('platform_commission_ledger').select('commission_stars, commission_cents')
  if (error) throw error
  const rows = data ?? []
  return {
    totalCommissionStars: rows.reduce((sum: number, row: any) => sum + (row.commission_stars ?? 0), 0),
    totalCommissionCents: rows.reduce((sum: number, row: any) => sum + (row.commission_cents ?? 0), 0),
  }
}
