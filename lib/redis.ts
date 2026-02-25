import axios from 'axios'

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || ''
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ''

async function redisRequest(command: string[]) {
  try {
    const response = await axios.post(
      `${REDIS_URL}/exec`,
      command,
      {
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )
    return response.data
  } catch (error) {
    console.error('Redis error:', error)
    throw error
  }
}

export async function setRateLimit(userId: string, limit: number, windowSeconds: number) {
  const key = `rate_limit:${userId}`
  
  try {
    // Increment counter
    const incrResult = await redisRequest(['INCR', key])
    const current = incrResult?.[0] || 1
    
    // Set expiration on first request
    if (current === 1) {
      await redisRequest(['EXPIRE', key, windowSeconds.toString()])
    }
    
    return current <= limit
  } catch (error) {
    console.error('Rate limit error:', error)
    return true // Allow on error
  }
}

export async function storeQueue(name: string, item: any) {
  try {
    const serialized = JSON.stringify(item)
    await redisRequest(['RPUSH', name, serialized])
  } catch (error) {
    console.error('Queue store error:', error)
  }
}

export async function consumeQueue(name: string) {
  try {
    const result = await redisRequest(['LPOP', name])
    return result?.[0] ? JSON.parse(result[0] as string) : null
  } catch (error) {
    console.error('Queue consume error:', error)
    return null
  }
}
