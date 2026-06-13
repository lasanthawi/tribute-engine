import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase, Database } from '@/lib/supabase'
import { getUserBalance } from '@/lib/ledger'
import { getLeagueProgress, LEAGUE_TIERS } from '@/lib/league'
import { isDemoMode } from '@/lib/demo'
import { demoProfile } from '@/lib/demo-data'
import { AchievementDto } from '@/lib/api-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (isDemoMode()) return res.status(200).json(demoProfile())

  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, streak_count, best_streak')
      .eq('id', userId)
      .single()
    if (userError) throw userError

    const { points } = await getUserBalance(userId)

    const { count: totalVotes, error: votesError } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (votesError) throw votesError

    const { count: totalCorrect, error: correctError } = await supabase
      .from('predictions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_correct', true)
    if (correctError) throw correctError

    const settledVotes = (totalVotes ?? 0)
    const accuracy = settledVotes > 0 ? Math.round(((totalCorrect ?? 0) / settledVotes) * 100) : 0

    const { data: defData, error: defError } = await supabase
      .from('achievement_definitions')
      .select('*')
      .order('sort_order', { ascending: true })
    if (defError) throw defError
    const definitions = (defData ?? []) as Database['public']['Tables']['achievement_definitions']['Row'][]

    const { data: unlocked, error: unlockedError } = await supabase
      .from('user_achievements')
      .select('achievement_definition_id, unlocked_at')
      .eq('user_id', userId)
    if (unlockedError) throw unlockedError

    const unlockedMap = new Map((unlocked ?? []).map((u) => [u.achievement_definition_id, u.unlocked_at]))
    const progress = getLeagueProgress(points)

    const achievements: AchievementDto[] = definitions.map((def) => {
      const unlockedAt = unlockedMap.get(def.id) ?? null
      let achProgress: number | null = null
      let target: number | null = null

      if (!unlockedAt) {
        switch (def.criteria_type) {
          case 'streak_reached':
            achProgress = user.streak_count
            target = def.criteria_value
            break
          case 'total_correct':
            achProgress = totalCorrect ?? 0
            target = def.criteria_value
            break
          case 'league_tier': {
            const tier = LEAGUE_TIERS.find((t) => t.name === def.criteria_text)
            achProgress = points
            target = tier?.minPoints ?? null
            break
          }
          default:
            break
        }
      }

      return {
        code: def.code,
        title: def.title,
        description: def.description,
        icon: def.icon,
        unlocked: unlockedAt !== null,
        unlockedAt,
        progress: achProgress,
        target,
      }
    })

    res.status(200).json({
      username: user.username,
      totalVotes: totalVotes ?? 0,
      totalCorrect: totalCorrect ?? 0,
      accuracy,
      bestStreak: user.best_streak,
      currentStreak: user.streak_count,
      points,
      league: {
        current: { name: progress.current.name, icon: progress.current.icon, color: progress.current.color },
        next: progress.next
          ? {
              name: progress.next.name,
              icon: progress.next.icon,
              color: progress.next.color,
              minPoints: progress.next.minPoints,
            }
          : null,
        progress: progress.progress,
        remaining: progress.remaining,
      },
      achievements,
    })
  } catch (error) {
    console.error('profile/index error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
