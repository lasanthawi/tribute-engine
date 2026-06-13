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
export type TicketReason = 'daily_grant' | 'prediction' | 'referral_reward' | 'refund' | 'coin_redeem'
export type CoinEntryType = 'purchase' | 'referral_bonus' | 'redeem_points' | 'redeem_ticket' | 'redeem_perk' | 'refund'
export type PerkType = 'confidence_boost' | 'streak_freeze'
export type PerkReason = 'redeem' | 'consume' | 'refund'

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
