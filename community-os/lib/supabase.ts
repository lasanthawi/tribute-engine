import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-mode-placeholder-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

export type CommunityMemberStatus = 'active' | 'inactive' | 'banned'
export type CommunityEventStatus = 'upcoming' | 'live' | 'done' | 'cancelled'

export interface Database {
  public: {
    Tables: {
      // Shared identity table — read/update only, never altered here.
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
      community_profiles: {
        Row: {
          user_id: number
          display_name: string | null
          bio: string | null
          role_title: string
          status: CommunityMemberStatus
          joined_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_profiles']['Row'], 'user_id'>> & {
          user_id: number
        }
        Update: Partial<Database['public']['Tables']['community_profiles']['Row']>
        Relationships: []
      }
      community_events: {
        Row: {
          id: number
          title: string
          description: string | null
          event_at: string
          created_by: number | null
          status: CommunityEventStatus
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['community_events']['Row'], 'id'>> & {
          title: string
          event_at: string
        }
        Update: Partial<Database['public']['Tables']['community_events']['Row']>
        Relationships: []
      }
      event_rsvps: {
        Row: {
          user_id: number
          event_id: number
          created_at: string
        }
        Insert: {
          user_id: number
          event_id: number
        }
        Update: Partial<Database['public']['Tables']['event_rsvps']['Row']>
        Relationships: []
      }
    }
    Views: {
      community_member_stats: {
        Row: {
          status: string
          member_count: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
  }
}
