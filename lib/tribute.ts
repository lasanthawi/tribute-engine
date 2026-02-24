import crypto from 'crypto'

export function verifyTributeSignature(
  body: Buffer,
  signature: string,
  apiKey: string
): boolean {
  const hash = crypto
    .createHmac('sha256', apiKey)
    .update(body)
    .digest('hex')
  
  return hash === signature
}

export interface TributeWebhookPayload {
  event_type: string
  data: {
    id: string
    user_id: string
    product_id: string
    amount?: number
    status?: string
    [key: string]: any
  }
  timestamp: number
}

export const TRIBUTE_EVENTS = {
  PURCHASE_SUCCESS: 'purchase_success',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  REFUND: 'refund',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
}
