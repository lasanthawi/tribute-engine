import { supabase, Asset, Database, QuestGoalType } from './supabase'
import { creditPoints, creditCoins, adjustTickets, grantPerk } from './ledger'

type QuestDefinition = Database['public']['Tables']['quest_definitions']['Row']
type QuestProgress = Database['public']['Tables']['user_quest_progress']['Row']

export interface QuestWithProgress {
  definition: QuestDefinition
  progress: number
  target: number
  completedAt: string | null
  claimedAt: string | null
  periodKey: string
}

function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** ISO 8601 week key, e.g. '2026-W24'. */
function toIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function periodKeyFor(type: QuestDefinition['type'], now: Date): string {
  return type === 'weekly' ? toIsoWeekKey(now) : toUtcDateString(now)
}

async function getOrCreateProgress(
  userId: number,
  definition: QuestDefinition,
  periodKey: string
): Promise<QuestProgress> {
  const { data: existing, error: selectError } = await supabase
    .from('user_quest_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_definition_id', definition.id)
    .eq('period_key', periodKey)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing as QuestProgress

  const { data: created, error: insertError } = await supabase
    .from('user_quest_progress')
    .insert({ user_id: userId, quest_definition_id: definition.id, period_key: periodKey, progress: 0 })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created as QuestProgress
}

export async function getActiveQuestsForUser(userId: number, now: Date = new Date()): Promise<QuestWithProgress[]> {
  const { data, error } = await supabase.from('quest_definitions').select('*').eq('is_active', true)
  if (error) throw error
  const definitions = (data ?? []) as QuestDefinition[]

  const results: QuestWithProgress[] = []
  for (const definition of definitions) {
    const periodKey = periodKeyFor(definition.type, now)
    const progress = await getOrCreateProgress(userId, definition, periodKey)
    results.push({
      definition,
      progress: progress.progress,
      target: definition.goal_target,
      completedAt: progress.completed_at,
      claimedAt: progress.claimed_at,
      periodKey,
    })
  }
  return results
}

/**
 * Increments progress for all active quests matching `goalType` (and `asset`
 * for asset_vote quests). Caps at goal_target and sets completed_at on
 * threshold. `reset: true` zeros progress without marking complete (used for
 * streak_maintain after an incorrect settlement). Never throws.
 */
export async function recordQuestProgress(
  userId: number,
  goalType: QuestGoalType,
  delta: number,
  opts: { asset?: Asset; reset?: boolean } = {},
  now: Date = new Date()
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('quest_definitions')
      .select('*')
      .eq('is_active', true)
      .eq('goal_type', goalType)
    if (error) throw error
    const definitions = (data ?? []) as QuestDefinition[]

    for (const definition of definitions) {
      if (goalType === 'asset_vote' && definition.goal_asset && definition.goal_asset !== opts.asset) continue

      const periodKey = periodKeyFor(definition.type, now)
      const progressRow = await getOrCreateProgress(userId, definition, periodKey)
      if (progressRow.completed_at && !opts.reset) continue

      if (opts.reset) {
        await supabase
          .from('user_quest_progress')
          .update({ progress: 0, completed_at: null })
          .eq('id', progressRow.id)
        continue
      }

      const newProgress = Math.min(definition.goal_target, progressRow.progress + delta)
      const completedAt =
        progressRow.completed_at ?? (newProgress >= definition.goal_target ? now.toISOString() : null)

      await supabase
        .from('user_quest_progress')
        .update({ progress: newProgress, completed_at: completedAt })
        .eq('id', progressRow.id)
    }
  } catch (e) {
    console.error('recordQuestProgress error:', e)
  }
}

export async function claimQuestReward(userId: number, questDefinitionId: number, now: Date = new Date()) {
  const { data: defData, error: defError } = await supabase
    .from('quest_definitions')
    .select('*')
    .eq('id', questDefinitionId)
    .single()
  if (defError) throw defError
  const definition = defData as QuestDefinition

  const periodKey = periodKeyFor(definition.type, now)
  const { data: progData, error: progError } = await supabase
    .from('user_quest_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('quest_definition_id', questDefinitionId)
    .eq('period_key', periodKey)
    .maybeSingle()
  if (progError) throw progError
  const progress = progData as QuestProgress | null
  if (!progress || !progress.completed_at) throw new Error('Quest not completed')
  if (progress.claimed_at) throw new Error('Quest already claimed')

  await grantQuestReward(userId, definition.reward_type, definition.reward_amount, definition.reward_perk_type)
  if (definition.reward_type_2 && definition.reward_amount_2) {
    await grantQuestReward(userId, definition.reward_type_2, definition.reward_amount_2, definition.reward_perk_type_2)
  }

  const { error: updateError } = await supabase
    .from('user_quest_progress')
    .update({ claimed_at: now.toISOString() })
    .eq('id', progress.id)
  if (updateError) throw updateError
}

async function grantQuestReward(
  userId: number,
  rewardType: QuestDefinition['reward_type'],
  amount: number,
  perkType: QuestDefinition['reward_perk_type']
) {
  switch (rewardType) {
    case 'points':
      await creditPoints(userId, amount, 'quest_reward')
      break
    case 'coins':
      await creditCoins(userId, amount, 'quest_reward')
      break
    case 'tickets':
      await adjustTickets(userId, amount, 'quest_reward')
      break
    case 'perk':
      if (perkType) await grantPerk(userId, perkType, amount)
      break
  }
}
