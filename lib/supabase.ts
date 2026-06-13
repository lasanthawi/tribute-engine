import { createClient } from '@supabase/supabase-js'

// Falls back to placeholder values in demo mode (no Supabase project configured yet)
// so the client can be constructed without crashing at import time.
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-mode-placeholder-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

export type Asset = 'BTC' | 'ETH' | 'TON'
export type RoundKind = 'hourly' | 'main_daily'
export type RoundState =
  | 'SCHEDULED'
  | 'OPEN'
  | 'LOCKED'
  | 'SETTLING'
  | 'SETTLED'
  | 'VOIDED'
export type RoundOutcome = 'UP' | 'DOWN' | 'VOID'
export type PredictionSide = 'UP' | 'DOWN'
export type ReferralStatus = 'pending' | 'activated'
export type LedgerEntryType =
  | 'prediction_win'
  | 'stake'
  | 'stake_return'
  | 'streak_bonus'
  | 'daily_login'
  | 'referral_bonus'
  | 'referral_override'
  | 'refund'
  | 'coin_redeem'
  | 'quest_reward'
export type TicketReason = 'daily_grant' | 'prediction' | 'referral_reward' | 'refund' | 'coin_redeem' | 'quest_reward' | 'winback_bonus'
export type CoinEntryType =
  | 'purchase'
  | 'referral_bonus'
  | 'redeem_points'
  | 'redeem_ticket'
  | 'redeem_perk'
  | 'refund'
  | 'quest_reward'
export type PerkType = 'confidence_boost' | 'streak_freeze'
export type PerkReason = 'redeem' | 'consume' | 'refund' | 'quest_reward'
export type QuestType = 'daily' | 'weekly'
export type QuestGoalType = 'vote_count' | 'correct_count' | 'asset_vote' | 'streak_maintain' | 'login'
export type QuestRewardType = 'points' | 'coins' | 'tickets' | 'perk'
export type AchievementCriteriaType =
  | 'first_vote'
  | 'first_win'
  | 'streak_reached'
  | 'total_correct'
  | 'perfect_day'
  | 'league_tier'

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
          best_streak: number
          notifications_enabled: boolean
        }
        Insert: Partial<Omit<Database['public']['Tables']['users']['Row'], 'id'>> & {
          telegram_id: number
        }
        Update: Partial<Database['public']['Tables']['users']['Row']>
        Relationships: []
      }
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
      squads: {
        Row: {
          id: number
          name: string
          captain_id: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['squads']['Row'], 'id'>> & {
          name: string
          captain_id: number
        }
        Update: Partial<Database['public']['Tables']['squads']['Row']>
        Relationships: []
      }
      squad_members: {
        Row: {
          squad_id: number
          user_id: number
          joined_at: string
        }
        Insert: Partial<Database['public']['Tables']['squad_members']['Row']> & {
          squad_id: number
          user_id: number
        }
        Update: Partial<Database['public']['Tables']['squad_members']['Row']>
        Relationships: []
      }
      seasons: {
        Row: {
          id: number
          name: string
          starts_at: string
          ends_at: string | null
          is_active: boolean
        }
        Insert: Partial<Omit<Database['public']['Tables']['seasons']['Row'], 'id'>> & {
          name: string
          starts_at: string
        }
        Update: Partial<Database['public']['Tables']['seasons']['Row']>
        Relationships: []
      }
      rounds: {
        Row: {
          id: number
          season_id: number
          asset: Asset
          kind: RoundKind
          state: RoundState
          open_at: string
          lock_at: string
          resolve_at: string
          strike: number | null
          close: number | null
          outcome: RoundOutcome | null
          base_reward: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['rounds']['Row'], 'id'>> & {
          season_id: number
          asset: Asset
          kind: RoundKind
          open_at: string
          lock_at: string
          resolve_at: string
        }
        Update: Partial<Database['public']['Tables']['rounds']['Row']>
        Relationships: []
      }
      predictions: {
        Row: {
          id: number
          round_id: number
          user_id: number
          side: PredictionSide
          confidence: number
          is_correct: boolean | null
          points_earned: number | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['predictions']['Row'], 'id'>> & {
          round_id: number
          user_id: number
          side: PredictionSide
        }
        Update: Partial<Database['public']['Tables']['predictions']['Row']>
        Relationships: [
          {
            foreignKeyName: 'predictions_round_id_fkey'
            columns: ['round_id']
            referencedRelation: 'rounds'
            referencedColumns: ['id']
          }
        ]
      }
      points_ledger: {
        Row: {
          id: number
          user_id: number
          delta: number
          entry_type: LedgerEntryType
          ref_round: number | null
          ref_user: number | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['points_ledger']['Row'], 'id'>> & {
          user_id: number
          delta: number
          entry_type: LedgerEntryType
        }
        Update: Partial<Database['public']['Tables']['points_ledger']['Row']>
        Relationships: []
      }
      ticket_ledger: {
        Row: {
          id: number
          user_id: number
          delta: number
          reason: TicketReason
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['ticket_ledger']['Row'], 'id'>> & {
          user_id: number
          delta: number
          reason: TicketReason
        }
        Update: Partial<Database['public']['Tables']['ticket_ledger']['Row']>
        Relationships: []
      }
      coins_ledger: {
        Row: {
          id: number
          user_id: number
          delta: number
          entry_type: CoinEntryType
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['coins_ledger']['Row'], 'id'>> & {
          user_id: number
          delta: number
          entry_type: CoinEntryType
        }
        Update: Partial<Database['public']['Tables']['coins_ledger']['Row']>
        Relationships: []
      }
      perks_ledger: {
        Row: {
          id: number
          user_id: number
          perk_type: PerkType
          delta: number
          reason: PerkReason
          ref_round: number | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['perks_ledger']['Row'], 'id'>> & {
          user_id: number
          perk_type: PerkType
          delta: number
          reason: PerkReason
        }
        Update: Partial<Database['public']['Tables']['perks_ledger']['Row']>
        Relationships: []
      }
      coin_purchases: {
        Row: {
          id: number
          user_id: number
          telegram_charge_id: string
          stars_amount: number
          coins_amount: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['coin_purchases']['Row'], 'id'>> & {
          user_id: number
          telegram_charge_id: string
          stars_amount: number
          coins_amount: number
        }
        Update: Partial<Database['public']['Tables']['coin_purchases']['Row']>
        Relationships: []
      }
      quest_definitions: {
        Row: {
          id: number
          code: string
          title: string
          description: string
          type: QuestType
          goal_type: QuestGoalType
          goal_asset: Asset | null
          goal_target: number
          reward_type: QuestRewardType
          reward_amount: number
          reward_perk_type: PerkType | null
          reward_type_2: QuestRewardType | null
          reward_amount_2: number | null
          reward_perk_type_2: PerkType | null
          is_active: boolean
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['quest_definitions']['Row'], 'id'>> & {
          code: string
          title: string
          description: string
          type: QuestType
          goal_type: QuestGoalType
          goal_target: number
          reward_type: QuestRewardType
          reward_amount: number
        }
        Update: Partial<Database['public']['Tables']['quest_definitions']['Row']>
        Relationships: []
      }
      user_quest_progress: {
        Row: {
          id: number
          user_id: number
          quest_definition_id: number
          period_key: string
          progress: number
          completed_at: string | null
          claimed_at: string | null
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['user_quest_progress']['Row'], 'id'>> & {
          user_id: number
          quest_definition_id: number
          period_key: string
        }
        Update: Partial<Database['public']['Tables']['user_quest_progress']['Row']>
        Relationships: [
          {
            foreignKeyName: 'user_quest_progress_quest_definition_id_fkey'
            columns: ['quest_definition_id']
            referencedRelation: 'quest_definitions'
            referencedColumns: ['id']
          }
        ]
      }
      achievement_definitions: {
        Row: {
          id: number
          code: string
          title: string
          description: string
          icon: string
          criteria_type: AchievementCriteriaType
          criteria_value: number | null
          criteria_text: string | null
          sort_order: number
          created_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['achievement_definitions']['Row'], 'id'>> & {
          code: string
          title: string
          description: string
          icon: string
          criteria_type: AchievementCriteriaType
        }
        Update: Partial<Database['public']['Tables']['achievement_definitions']['Row']>
        Relationships: []
      }
      user_achievements: {
        Row: {
          id: number
          user_id: number
          achievement_definition_id: number
          unlocked_at: string
        }
        Insert: Partial<Omit<Database['public']['Tables']['user_achievements']['Row'], 'id'>> & {
          user_id: number
          achievement_definition_id: number
        }
        Update: Partial<Database['public']['Tables']['user_achievements']['Row']>
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_definition_id_fkey'
            columns: ['achievement_definition_id']
            referencedRelation: 'achievement_definitions'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      user_balances: {
        Row: {
          user_id: number
          points: number
          tickets: number
          coins: number
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
  }
}
