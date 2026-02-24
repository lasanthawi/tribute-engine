import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          telegram_user_id: string
          telegram_username: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'>
      }
      events: {
        Row: {
          id: string
          source: string
          event_type: string
          payload: Record<string, any>
          created_at: string
        }
      }
      entitlements: {
        Row: {
          id: string
          telegram_user_id: string
          product_type: 'subscription' | 'digital_product' | 'tools_access'
          status: 'active' | 'revoked'
          expires_at: string | null
          created_at: string
        }
      }
      deliveries: {
        Row: {
          id: string
          telegram_user_id: string
          delivery_type: 'welcome' | 'blueprint' | 'files'
          status: 'pending' | 'sent' | 'failed'
          payload: Record<string, any>
          created_at: string
        }
      }
    }
  }
}
