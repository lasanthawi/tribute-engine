// VOTE LEAGUE — mini-game template schemas, config-driven engines, and guardrails
//
// A "game" is a row in the `games` table: a `template` (which generic engine
// renders/plays it) plus a `config` (JSONB params for that engine). New games
// are new config rows, not new code.

export type GameTemplate = 'tap_catch' | 'spin_wheel'
export type GameStatus = 'draft' | 'testing' | 'published' | 'retired'

// Catalog rotation: when this many games are published, the autonomous
// publisher must retire the worst-performing one before adding a new one.
export const MAX_PUBLISHED_GAMES = 6

// ---------- tap_catch ----------

export interface TapCatchObject {
  id: string
  label: string
  color: string
  weight: number
}

export interface TapCatchRewardTier {
  minScore: number
  points: number
}

export interface TapCatchConfig {
  durationSec: number
  spawnMinMs: number
  spawnMaxMs: number
  objects: TapCatchObject[]
  rewardCurve: TapCatchRewardTier[]
  maxScore: number
  theme: { bg: string; accent: string }
}

/** Tiered points reward for a tap_catch game based on a server-validated score. */
export function computeTapRewardFromCurve(score: number, config: TapCatchConfig): number {
  const clamped = Math.max(0, Math.min(config.maxScore, Math.trunc(score)))
  const tiers = [...config.rewardCurve].sort((a, b) => a.minScore - b.minScore)
  let points = 0
  for (const tier of tiers) {
    if (clamped >= tier.minScore) points = tier.points
  }
  return points
}

// ---------- spin_wheel ----------

export interface SpinWheelSegment {
  label: string
  weight: number
  rewardPoints: number
  rewardTickets: number
  rewardCoins: number
}

export interface SpinWheelConfig {
  segments: SpinWheelSegment[]
}

/** Weighted-random segment pick for a spin_wheel game. */
export function pickSpinSegment(config: SpinWheelConfig): { segmentIndex: number; segment: SpinWheelSegment } {
  const segments = config.segments
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0)
  let roll = Math.random() * totalWeight
  let segmentIndex = segments.length - 1
  for (let i = 0; i < segments.length; i++) {
    roll -= segments[i].weight
    if (roll <= 0) {
      segmentIndex = i
      break
    }
  }
  return { segmentIndex, segment: segments[segmentIndex] }
}

// ---------- guardrails ----------
//
// Automated test gate for the self-evolving game publisher: any config that
// fails these checks cannot be published, with no human in the loop.

const MAX_REWARD_POINTS_PER_PLAY = 300
const MAX_EXPECTED_VALUE_PER_PLAY = 60

export interface ConfigValidationResult {
  valid: boolean
  errors: string[]
}

export function validateTapCatchConfig(config: TapCatchConfig): ConfigValidationResult {
  const errors: string[] = []

  if (!Number.isFinite(config.durationSec) || config.durationSec < 10 || config.durationSec > 60) {
    errors.push('durationSec must be between 10 and 60')
  }
  if (!Number.isFinite(config.spawnMinMs) || !Number.isFinite(config.spawnMaxMs) || config.spawnMinMs <= 0 || config.spawnMaxMs < config.spawnMinMs) {
    errors.push('spawnMinMs/spawnMaxMs must be positive with spawnMinMs <= spawnMaxMs')
  }
  if (config.spawnMinMs < 200) {
    errors.push('spawnMinMs must be >= 200ms (avoid unplayable spawn rates)')
  }
  if (!Array.isArray(config.objects) || config.objects.length < 1 || config.objects.length > 6) {
    errors.push('objects must contain between 1 and 6 entries')
  }
  if (!Number.isFinite(config.maxScore) || config.maxScore < 1 || config.maxScore > 200) {
    errors.push('maxScore must be between 1 and 200')
  }
  if (!Array.isArray(config.rewardCurve) || config.rewardCurve.length < 1) {
    errors.push('rewardCurve must contain at least one tier')
  } else {
    const maxPoints = Math.max(...config.rewardCurve.map((t) => t.points))
    if (maxPoints > MAX_REWARD_POINTS_PER_PLAY) {
      errors.push(`rewardCurve max points (${maxPoints}) exceeds cap of ${MAX_REWARD_POINTS_PER_PLAY}`)
    }
    if (config.rewardCurve.some((t) => t.points < 0 || t.minScore < 0)) {
      errors.push('rewardCurve entries must be non-negative')
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateSpinWheelConfig(config: SpinWheelConfig): ConfigValidationResult {
  const errors: string[] = []

  if (!Array.isArray(config.segments) || config.segments.length < 3 || config.segments.length > 10) {
    errors.push('segments must contain between 3 and 10 entries')
    return { valid: false, errors }
  }

  const totalWeight = config.segments.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight <= 0) {
    errors.push('segment weights must sum to a positive number')
    return { valid: false, errors }
  }

  for (const s of config.segments) {
    if (s.weight < 0) errors.push(`segment "${s.label}" has negative weight`)
    if (s.rewardPoints < 0 || s.rewardTickets < 0 || s.rewardCoins < 0) {
      errors.push(`segment "${s.label}" has a negative reward`)
    }
    if (s.rewardPoints > MAX_REWARD_POINTS_PER_PLAY) {
      errors.push(`segment "${s.label}" rewardPoints (${s.rewardPoints}) exceeds cap of ${MAX_REWARD_POINTS_PER_PLAY}`)
    }
  }

  // Approximate expected value: tickets/coins weighted in as point-equivalents
  // (1 ticket ~ 50 pts, 1 coin ~ 10 pts) — rough but enough for a guardrail.
  const ev = config.segments.reduce((sum, s) => {
    const points = s.rewardPoints + s.rewardTickets * 50 + s.rewardCoins * 10
    return sum + (s.weight / totalWeight) * points
  }, 0)
  if (ev > MAX_EXPECTED_VALUE_PER_PLAY) {
    errors.push(`expected value per spin (${ev.toFixed(1)}) exceeds cap of ${MAX_EXPECTED_VALUE_PER_PLAY}`)
  }

  return { valid: errors.length === 0, errors }
}

export function validateGameConfig(template: GameTemplate, config: unknown): ConfigValidationResult {
  if (template === 'tap_catch') return validateTapCatchConfig(config as TapCatchConfig)
  if (template === 'spin_wheel') return validateSpinWheelConfig(config as SpinWheelConfig)
  return { valid: false, errors: [`Unknown template: ${template}`] }
}
