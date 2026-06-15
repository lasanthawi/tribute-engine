import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-mode-placeholder-key'

export const isDemoMode = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

export type CommunityStatus = 'active' | 'paused' | 'archived'
export type CommunityRole = 'owner' | 'admin' | 'member'
export type AccessStatus = 'pending' | 'granted' | 'revoked' | 'expired' | 'failed'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'expired' | 'cancelled'
export type PlanStatus = 'active' | 'paused' | 'archived'
export type RewardType = 'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'sponsor' | 'manual'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number
          telegram_id: number
          username: string | null
          ton_address: string | null
          created_at: string
          last_seen_at: string | null
          streak_count: number
          streak_last_day: string | null
        }
        Insert: Partial<Omit<Database['public']['Tables']['users']['Row'], 'id'>> & {
          telegram_id: number
        }
        Update: Partial<Database['public']['Tables']['users']['Row']>
        Relationships: []
      }
      communities: {
        Row: {
          id: number
          owner_id: number
          name: string
          handle: string | null
          description: string | null
          telegram_chat_id: number | null
          telegram_invite_url: string | null
          status: CommunityStatus
          settings: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['communities']['Row'], 'id'>> & {
          owner_id: number
          name: string
        }
        Update: Partial<Database['public']['Tables']['communities']['Row']>
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: number
          user_id: number
          role: CommunityRole
          access_status: AccessStatus
          source: string
          joined_at: string
          last_active_at: string | null
          notes: string | null
        }
        Insert: Partial<Database['public']['Tables']['community_members']['Row']> & {
          community_id: number
          user_id: number
        }
        Update: Partial<Database['public']['Tables']['community_members']['Row']>
        Relationships: []
      }
      membership_plans: {
        Row: {
          id: number
          community_id: number
          name: string
          description: string | null
          price_cents: number
          currency: string
          interval: string
          benefits: unknown[]
          status: PlanStatus
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['membership_plans']['Row'], 'id'>> & {
          community_id: number
          name: string
        }
        Update: Partial<Database['public']['Tables']['membership_plans']['Row']>
        Relationships: []
      }
      member_subscriptions: {
        Row: {
          id: number
          community_id: number
          user_id: number
          plan_id: number | null
          status: SubscriptionStatus
          current_period_start: string | null
          current_period_end: string | null
          payment_provider: string
          payment_reference: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['member_subscriptions']['Row'], 'id'>> & {
          community_id: number
          user_id: number
        }
        Update: Partial<Database['public']['Tables']['member_subscriptions']['Row']>
        Relationships: []
      }
      community_referrals: {
        Row: {
          id: number
          community_id: number
          referrer_id: number
          referee_id: number | null
          referral_code: string
          status: string
          clicks: number
          revenue_cents: number
          created_at: string
          activated_at: string | null
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_referrals']['Row'], 'id'>> & {
          community_id: number
          referrer_id: number
          referral_code: string
        }
        Update: Partial<Database['public']['Tables']['community_referrals']['Row']>
        Relationships: []
      }
      community_xp_ledger: {
        Row: {
          id: number
          community_id: number
          user_id: number
          delta: number
          entry_type: string
          ref_user: number | null
          ref_event: number | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_xp_ledger']['Row'], 'id'>> & {
          community_id: number
          user_id: number
          delta: number
          entry_type: string
        }
        Update: Partial<Database['public']['Tables']['community_xp_ledger']['Row']>
        Relationships: []
      }
      community_rewards: {
        Row: {
          id: number
          community_id: number
          type: RewardType
          title: string
          description: string | null
          criteria: Record<string, unknown>
          status: string
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_rewards']['Row'], 'id'>> & {
          community_id: number
          type: RewardType
          title: string
        }
        Update: Partial<Database['public']['Tables']['community_rewards']['Row']>
        Relationships: []
      }
      community_user_rewards: {
        Row: {
          id: number
          community_id: number
          user_id: number
          reward_id: number
          claimed_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_user_rewards']['Row'], 'id'>> & {
          community_id: number
          user_id: number
          reward_id: number
        }
        Update: Partial<Database['public']['Tables']['community_user_rewards']['Row']>
        Relationships: []
      }
      community_activity_events: {
        Row: {
          id: number
          community_id: number
          user_id: number | null
          event_type: string
          title: string
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_activity_events']['Row'], 'id'>> & {
          community_id: number
          event_type: string
          title: string
        }
        Update: Partial<Database['public']['Tables']['community_activity_events']['Row']>
        Relationships: []
      }
      telegram_access_logs: {
        Row: {
          id: number
          community_id: number
          user_id: number | null
          action: string
          status: string
          message: string | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['telegram_access_logs']['Row'], 'id'>> & {
          community_id: number
          action: string
        }
        Update: Partial<Database['public']['Tables']['telegram_access_logs']['Row']>
        Relationships: []
      }
      community_ai_settings: {
        Row: {
          community_id: number
          faq_enabled: boolean
          welcome_enabled: boolean
          reports_enabled: boolean
          faq_sources: unknown[]
          tone: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['community_ai_settings']['Row']> & {
          community_id: number
        }
        Update: Partial<Database['public']['Tables']['community_ai_settings']['Row']>
        Relationships: []
      }
    }
    Views: {
      community_user_xp_totals: {
        Row: {
          community_id: number
          user_id: number
          xp: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
  }
}

export type UserRow = Database['public']['Tables']['users']['Row']
export type CommunityRow = Database['public']['Tables']['communities']['Row']
export type CommunityMemberRow = Database['public']['Tables']['community_members']['Row']
export type MembershipPlanRow = Database['public']['Tables']['membership_plans']['Row']
export type CommunityReferralRow = Database['public']['Tables']['community_referrals']['Row']
export type CommunityRewardRow = Database['public']['Tables']['community_rewards']['Row']
export type ActivityEventRow = Database['public']['Tables']['community_activity_events']['Row']
export type AccessLogRow = Database['public']['Tables']['telegram_access_logs']['Row']
