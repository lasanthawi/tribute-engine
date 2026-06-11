import axios from 'axios'
import { Asset } from './supabase'

// Pyth Hermes price feed IDs (mainnet) — overridable via env for testnet/custom feeds.
const PYTH_FEED_IDS: Record<Asset, string> = {
  BTC: process.env.PYTH_FEED_BTC || 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: process.env.PYTH_FEED_ETH || 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  TON: process.env.PYTH_FEED_TON || '8963217838ab4cf5cadc172203c1f0b763fbaa45f346d8ee50ba994bbcac3026',
}

const BINANCE_SYMBOLS: Record<Asset, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  TON: 'TONUSDT',
}

const PYTH_HERMES_URL = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network'
const RECONCILE_TOLERANCE = 0.005 // 0.5%

export interface OraclePrice {
  price: number
  sources: {
    pyth: number | null
    binance: number | null
  }
}

export class OracleVoidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OracleVoidError'
  }
}

async function fetchPythPrice(asset: Asset): Promise<number | null> {
  try {
    const id = PYTH_FEED_IDS[asset]
    const res = await axios.get(`${PYTH_HERMES_URL}/v2/updates/price/latest`, {
      params: { 'ids[]': id },
    })
    const parsed = res.data?.parsed?.[0]
    if (!parsed) return null
    const { price, expo } = parsed.price
    return Number(price) * Math.pow(10, expo)
  } catch (error) {
    console.error(`Pyth price fetch failed for ${asset}:`, error)
    return null
  }
}

async function fetchBinancePrice(asset: Asset): Promise<number | null> {
  try {
    const symbol = BINANCE_SYMBOLS[asset]
    const res = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol },
    })
    return Number(res.data?.price) || null
  } catch (error) {
    console.error(`Binance price fetch failed for ${asset}:`, error)
    return null
  }
}

/**
 * Fetch and reconcile a price from the primary (Pyth) and secondary (Binance)
 * oracles. Throws OracleVoidError if both feeds are unavailable or they
 * diverge beyond the reconciliation tolerance — callers should VOID the round.
 */
export async function getReconciledPrice(asset: Asset): Promise<OraclePrice> {
  const [pyth, binance] = await Promise.all([fetchPythPrice(asset), fetchBinancePrice(asset)])

  if (pyth === null && binance === null) {
    throw new OracleVoidError(`No oracle feed available for ${asset}`)
  }

  if (pyth !== null && binance !== null) {
    const diff = Math.abs(pyth - binance) / pyth
    if (diff > RECONCILE_TOLERANCE) {
      throw new OracleVoidError(
        `Oracle feeds diverged for ${asset}: pyth=${pyth} binance=${binance} diff=${(diff * 100).toFixed(2)}%`
      )
    }
    return { price: (pyth + binance) / 2, sources: { pyth, binance } }
  }

  return { price: (pyth ?? binance)!, sources: { pyth, binance } }
}
