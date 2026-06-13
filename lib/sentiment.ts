import axios from 'axios'
import { cacheGet, cacheSet } from './redis'
import { Asset } from './supabase'

const CACHE_TTL = 1800 // 30 minutes

export interface FearGreedData {
  score: number
  label: string
  updatedAt: string
}

export interface NewsHeadline {
  id: string
  title: string
  url: string
  source: string
  sentiment: 'positive' | 'negative' | 'neutral'
  publishedAt: string
}

/** Crypto Fear & Greed Index (alternative.me) — free, no API key. */
export async function getFearGreedIndex(): Promise<FearGreedData | null> {
  const cacheKey = 'sentiment:feargreed'
  const cached = await cacheGet(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as FearGreedData
    } catch {
      // fall through to refetch
    }
  }

  try {
    const res = await axios.get('https://api.alternative.me/fng/', { params: { limit: 1 } })
    const entry = res.data?.data?.[0]
    if (!entry) return null

    const result: FearGreedData = {
      score: Number(entry.value),
      label: entry.value_classification,
      updatedAt: new Date(Number(entry.timestamp) * 1000).toISOString(),
    }

    await cacheSet(cacheKey, JSON.stringify(result), CACHE_TTL)
    return result
  } catch (error) {
    console.error('Fear & Greed fetch failed:', error)
    return null
  }
}

/** Recent crypto news headlines from CryptoPanic — requires CRYPTOPANIC_API_KEY. */
export async function getNewsHeadlines(asset?: Asset): Promise<NewsHeadline[]> {
  const apiKey = process.env.CRYPTOPANIC_API_KEY
  if (!apiKey) return []

  const cacheKey = `sentiment:news:${asset ?? 'ALL'}`
  const cached = await cacheGet(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as NewsHeadline[]
    } catch {
      // fall through to refetch
    }
  }

  try {
    const res = await axios.get('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: apiKey,
        currencies: asset ?? 'BTC,ETH,TON',
        filter: 'hot',
        public: 'true',
      },
    })

    const results: NewsHeadline[] = (res.data?.results ?? []).slice(0, 5).map((post: any) => {
      const positive = post.votes?.positive ?? 0
      const negative = post.votes?.negative ?? 0
      const sentiment: NewsHeadline['sentiment'] =
        positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'

      return {
        id: String(post.id),
        title: post.title,
        url: post.url,
        source: post.source?.title ?? post.domain ?? 'unknown',
        sentiment,
        publishedAt: post.published_at,
      }
    })

    await cacheSet(cacheKey, JSON.stringify(results), CACHE_TTL)
    return results
  } catch (error) {
    console.error('CryptoPanic fetch failed:', error)
    return []
  }
}
