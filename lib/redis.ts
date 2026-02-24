import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function setRateLimit(userId: string, limit: number, windowSeconds: number) {
  const key = `rate_limit:${userId}`
  const current = await redis.incr(key)
  
  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }
  
  return current <= limit
}

export async function storeQueue(name: string, item: any) {
  await redis.rpush(name, JSON.stringify(item))
}

export async function consumeQueue(name: string) {
  const item = await redis.lpop(name)
  return item ? JSON.parse(item as string) : null
}
