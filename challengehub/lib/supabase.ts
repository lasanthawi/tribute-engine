import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-mode-placeholder-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

export type ReferralStatus = 'pending' | 'activated'

export type XpEntryType =
  | 'join_challenge'
  | 'daily_task'
  | 'invite_friend'
  | 'finish_challenge'
  | 'referral_bonus'

export type ChallengeStatus = 'upcoming' | 'active' | 'completed' | 'cancelled'
export type ChallengeMemberStatus = 'active' | 'completed' | 'dropped'
export type SubmissionEvidenceType = 'text' | 'screenshot' | 'link'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type RewardType = 'badge' | 'certificate' | 'digital_product' | 'premium_access' | 'cash' | 'sponsor'

export interface Database {
  public: {
    Tables: {
      // Shared identity table (from tribute-engine) — read/update only, never altered here.
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
      // Shared referral graph (from tribute-engine)
      referrals: {
        Row: {
          id: number
          referrer_id: number
          referee_id: number
          status: ReferralStatus
          created_at: string
          activated_at: string | null
        }
        Insert: Partial<Omit<Database['public']['Tables']['referrals']['Row'], 'id'>> & {
          referrer_id: number
          referee_id: number
        }
        Update: Partial<Database['public']['Tables']['referrals']['Row']>
        Relationships: []
      }
      challengehub_profiles: {
        Row: {
          user_id: number
          xp: number
          level: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['challengehub_profiles']['Row'], 'user_id'>> & {
          user_id: number
        }
        Update: Partial<Database['public']['Tables']['challengehub_profiles']['Row']>
        Relationships: []
      }
      challenges: {
        Row: {
          id: number
          title: string
          description: string
          cover_url: string | null
          start_date: string
          end_date: string
          status: ChallengeStatus
          creator_id: number
          rules: string | null
          rewards: Record<string, unknown> | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['challenges']['Row'], 'id'>> & {
          title: string
          description: string
          start_date: string
          end_date: string
          creator_id: number
        }
        Update: Partial<Database['public']['Tables']['challenges']['Row']>
        Relationships: []
      }
      daily_tasks: {
        Row: {
          id: number
          challenge_id: number
          day: number
          title: string
          description: string | null
          xp_reward: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['daily_tasks']['Row'], 'id'>> & {
          challenge_id: number
          day: number
          title: string
        }
        Update: Partial<Database['public']['Tables']['daily_tasks']['Row']>
        Relationships: [
          {
            foreignKeyName: 'daily_tasks_challenge_id_fkey'
            columns: ['challenge_id']
            referencedRelation: 'challenges'
            referencedColumns: ['id']
          }
        ]
      }
      challenge_members: {
        Row: {
          user_id: number
          challenge_id: number
          joined_at: string
          status: ChallengeMemberStatus
        }
        Insert: Partial<Database['public']['Tables']['challenge_members']['Row']> & {
          user_id: number
          challenge_id: number
        }
        Update: Partial<Database['public']['Tables']['challenge_members']['Row']>
        Relationships: []
      }
      task_submissions: {
        Row: {
          id: number
          user_id: number
          task_id: number
          evidence_type: SubmissionEvidenceType
          evidence_content: string | null
          status: SubmissionStatus
          submitted_at: string
          reviewed_at: string | null
        }
        Insert: Partial<Omit<Database['public']['Tables']['task_submissions']['Row'], 'id'>> & {
          user_id: number
          task_id: number
          evidence_type: SubmissionEvidenceType
        }
        Update: Partial<Database['public']['Tables']['task_submissions']['Row']>
        Relationships: []
      }
      xp_ledger: {
        Row: {
          id: number
          user_id: number
          delta: number
          entry_type: XpEntryType
          ref_challenge: number | null
          ref_user: number | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['xp_ledger']['Row'], 'id'>> & {
          user_id: number
          delta: number
          entry_type: XpEntryType
        }
        Update: Partial<Database['public']['Tables']['xp_ledger']['Row']>
        Relationships: []
      }
      rewards: {
        Row: {
          id: number
          challenge_id: number | null
          type: RewardType
          title: string
          description: string | null
          criteria: Record<string, unknown> | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['rewards']['Row'], 'id'>> & {
          type: RewardType
          title: string
        }
        Update: Partial<Database['public']['Tables']['rewards']['Row']>
        Relationships: []
      }
      user_rewards: {
        Row: {
          id: number
          user_id: number
          reward_id: number
          claimed_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['user_rewards']['Row'], 'id'>> & {
          user_id: number
          reward_id: number
        }
        Update: Partial<Database['public']['Tables']['user_rewards']['Row']>
        Relationships: [
          {
            foreignKeyName: 'user_rewards_reward_id_fkey'
            columns: ['reward_id']
            referencedRelation: 'rewards'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      user_xp_totals: {
        Row: {
          user_id: number
          xp: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
  }
}
