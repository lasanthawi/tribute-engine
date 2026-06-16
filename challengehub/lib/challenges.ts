import { supabase, ChallengeStatus, SubmissionEvidenceType } from './supabase'
import { creditXp } from './xp'

const JOIN_CHALLENGE_XP = 10
const DAILY_TASK_DEFAULT_XP = 20

export async function listChallenges(status?: ChallengeStatus) {
  let query = supabase.from('challenges').select('*').order('start_date', { ascending: true })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getChallenge(challengeId: number) {
  const { data, error } = await supabase.from('challenges').select('*').eq('id', challengeId).maybeSingle()
  if (error) throw error
  return data
}

export async function getMembership(userId: number, challengeId: number) {
  const { data, error } = await supabase
    .from('challenge_members')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Joins a challenge, granting +10 XP on first join. Idempotent — no-op if already a member. */
export async function joinChallenge(userId: number, challengeId: number): Promise<{ joined: boolean }> {
  const existing = await getMembership(userId, challengeId)
  if (existing) return { joined: false }

  const { error } = await supabase
    .from('challenge_members')
    .insert({ user_id: userId, challenge_id: challengeId, status: 'active' })
  if (error) throw error

  await creditXp(userId, JOIN_CHALLENGE_XP, 'join_challenge', { refChallenge: challengeId })
  return { joined: true }
}

export async function listTasks(challengeId: number) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('day', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTask(taskId: number) {
  const { data, error } = await supabase.from('daily_tasks').select('*').eq('id', taskId).maybeSingle()
  if (error) throw error
  return data
}

/** Returns submission status keyed by task id for the given user across a set of tasks. */
export async function getSubmissionsForUser(userId: number, taskIds: number[]) {
  if (taskIds.length === 0) return new Map<number, { status: string; submitted_at: string }>()

  const { data, error } = await supabase
    .from('task_submissions')
    .select('task_id, status, submitted_at')
    .eq('user_id', userId)
    .in('task_id', taskIds)
  if (error) throw error

  return new Map((data ?? []).map((row) => [row.task_id, { status: row.status, submitted_at: row.submitted_at }]))
}

/** Returns true if this is the user's first-ever task submission (any challenge). */
export async function isFirstSubmission(userId: number): Promise<boolean> {
  const { count, error } = await supabase
    .from('task_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return (count ?? 0) === 0
}

/** Fraction of a task's XP awarded for a late "catch-up" check-in. */
export const CATCHUP_XP_RATIO = 0.5

/**
 * Records a check-in submission for a task and credits XP (the task's
 * configured reward, or the default — halved for late "catch-up" check-ins).
 * Returns the created submission row. Throws if the user has already
 * submitted this task (unique constraint).
 */
export async function submitTask(
  userId: number,
  taskId: number,
  evidenceType: SubmissionEvidenceType,
  evidenceContent: string | null,
  isCatchup = false
) {
  const task = await getTask(taskId)
  if (!task) throw new Error('Task not found')

  const { data: submission, error } = await supabase
    .from('task_submissions')
    .insert({
      user_id: userId,
      task_id: taskId,
      evidence_type: evidenceType,
      evidence_content: evidenceContent,
      status: 'approved', // MVP: auto-approve check-ins
      reviewed_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error

  const baseXp = task.xp_reward ?? DAILY_TASK_DEFAULT_XP
  const xpReward = isCatchup ? Math.max(1, Math.round(baseXp * CATCHUP_XP_RATIO)) : baseXp
  await creditXp(userId, xpReward, isCatchup ? 'catchup_task' : 'daily_task', { refChallenge: task.challenge_id })

  return { submission, task, xpAwarded: xpReward }
}

export { JOIN_CHALLENGE_XP, DAILY_TASK_DEFAULT_XP }
