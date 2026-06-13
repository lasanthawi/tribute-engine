import { supabase, Database } from './supabase'
import { getLeagueTier } from './league'

type AchievementDefinition = Database['public']['Tables']['achievement_definitions']['Row']

export interface UnlockedAchievement {
  code: string
  title: string
  description: string
  icon: string
}

interface AchievementContext {
  event: 'vote_cast' | 'settlement'
  correct?: boolean
  streakCount?: number
  points?: number
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Evaluates achievement criteria relevant to the given event and unlocks any
 * newly-met achievements. Never throws — internal errors are logged and
 * result in an empty return.
 */
export async function checkAndUnlockAchievements(
  userId: number,
  context: AchievementContext,
  now: Date = new Date()
): Promise<UnlockedAchievement[]> {
  try {
    const { data: defData, error: defError } = await supabase.from('achievement_definitions').select('*')
    if (defError) throw defError
    const definitions = (defData ?? []) as AchievementDefinition[]
    if (definitions.length === 0) return []

    const { data: unlocked, error: unlockedError } = await supabase
      .from('user_achievements')
      .select('achievement_definition_id')
      .eq('user_id', userId)
    if (unlockedError) throw unlockedError

    const unlockedIds = new Set((unlocked ?? []).map((u) => u.achievement_definition_id))
    const candidates = definitions.filter((d) => !unlockedIds.has(d.id))
    if (candidates.length === 0) return []

    const newlyUnlocked: UnlockedAchievement[] = []

    for (const def of candidates) {
      const met = await evaluateCriteria(userId, def, context, now)
      if (!met) continue

      const { error: insertError } = await supabase
        .from('user_achievements')
        .insert({ user_id: userId, achievement_definition_id: def.id })
      if (insertError) {
        if (insertError.code === '23505') continue // already unlocked (race)
        throw insertError
      }

      newlyUnlocked.push({ code: def.code, title: def.title, description: def.description, icon: def.icon })
    }

    return newlyUnlocked
  } catch (e) {
    console.error('checkAndUnlockAchievements error:', e)
    return []
  }
}

async function evaluateCriteria(
  userId: number,
  def: AchievementDefinition,
  context: AchievementContext,
  now: Date
): Promise<boolean> {
  switch (def.criteria_type) {
    case 'first_vote': {
      if (context.event !== 'vote_cast') return false
      const { count, error } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (error) throw error
      return (count ?? 0) >= 1
    }

    case 'first_win': {
      if (context.event !== 'settlement' || !context.correct) return false
      const { count, error } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_correct', true)
      if (error) throw error
      return (count ?? 0) >= 1
    }

    case 'streak_reached': {
      if (context.event !== 'settlement' || context.streakCount === undefined) return false
      return context.streakCount >= (def.criteria_value ?? 0)
    }

    case 'total_correct': {
      if (context.event !== 'settlement' || !context.correct) return false
      const { count, error } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_correct', true)
      if (error) throw error
      return (count ?? 0) >= (def.criteria_value ?? 0)
    }

    case 'perfect_day': {
      if (context.event !== 'settlement' || !context.correct) return false
      const startOfDay = new Date(`${toUtcDateString(now)}T00:00:00Z`)
      const { count, error } = await supabase
        .from('predictions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_correct', true)
        .gte('created_at', startOfDay.toISOString())
      if (error) throw error
      return (count ?? 0) >= (def.criteria_value ?? 0)
    }

    case 'league_tier': {
      if (context.event !== 'settlement' || context.points === undefined) return false
      const tier = getLeagueTier(context.points)
      return tier.name === def.criteria_text
    }

    default:
      return false
  }
}
