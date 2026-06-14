// VOTE LEAGUE — mini-game template schemas, config-driven engines, and guardrails
//
// A "game" is a row in the `games` table: a `template` (which generic engine
// renders/plays it) plus a `config` (JSONB params for that engine). New games
// are new config rows, not new code.

export type GameTemplate = 'tap_catch' | 'spin_wheel' | 'gomoku' | 'snake_run' | 'stack_tower'
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
  /** Optional logo image (e.g. "/games/icons/btc.svg") drawn over the colored circle instead of `label`. */
  iconUrl?: string
}

export interface TapCatchRewardTier {
  minScore: number
  points: number
}

export type TapCatchDirection = 'down' | 'up' | 'left' | 'right'

export interface TapCatchConfig {
  durationSec: number
  spawnMinMs: number
  spawnMaxMs: number
  objects: TapCatchObject[]
  /** Penalty objects mixed into the spawn pool — tapping one subtracts hazardPenalty from score. Optional, default none. */
  hazards?: TapCatchObject[]
  /** Score lost when a hazard is tapped (clamped at 0). Optional, default 1. */
  hazardPenalty?: number
  /** Travel direction of spawned objects across the canvas. Optional, default 'down'. */
  direction?: TapCatchDirection
  /** Fractional speed increase per second of play, e.g. 0.05 = +5%/sec. Optional, default 0. */
  speedRamp?: number
  rewardCurve: TapCatchRewardTier[]
  maxScore: number
  theme: { bg: string; accent: string }
}

/** Tiered points reward for any score-based game (tap_catch, snake_run, ...) based on a server-validated score. */
export function computeRewardFromCurve(score: number, maxScore: number, rewardCurve: TapCatchRewardTier[]): number {
  const clamped = Math.max(0, Math.min(maxScore, Math.trunc(score)))
  const tiers = [...rewardCurve].sort((a, b) => a.minScore - b.minScore)
  let points = 0
  for (const tier of tiers) {
    if (clamped >= tier.minScore) points = tier.points
  }
  return points
}

/** Tiered points reward for a tap_catch game based on a server-validated score. */
export function computeTapRewardFromCurve(score: number, config: TapCatchConfig): number {
  return computeRewardFromCurve(score, config.maxScore, config.rewardCurve)
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

  if (config.direction !== undefined && !['down', 'up', 'left', 'right'].includes(config.direction)) {
    errors.push('direction must be one of "down", "up", "left", "right"')
  }
  if (config.hazards !== undefined) {
    if (!Array.isArray(config.hazards) || config.hazards.length > 4) {
      errors.push('hazards must be an array of at most 4 entries')
    }
  }
  if (config.hazardPenalty !== undefined) {
    if (!Number.isFinite(config.hazardPenalty) || config.hazardPenalty < 0 || config.hazardPenalty > 10) {
      errors.push('hazardPenalty must be between 0 and 10')
    }
  }
  if (config.speedRamp !== undefined) {
    if (!Number.isFinite(config.speedRamp) || config.speedRamp < 0 || config.speedRamp > 0.2) {
      errors.push('speedRamp must be between 0 and 0.2 (0-20% speed increase per second)')
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

// ---------- snake_run ----------
//
// Classic grid-snake: steer with swipes/arrows, eat food to grow and score,
// avoid walls (unless wrap is on), your own tail, and any obstacles. Reward
// is a tiered curve over the final score (food eaten), same shape as
// tap_catch's rewardCurve/maxScore.

export interface SnakeConfig {
  /** Square grid dimension, e.g. 14 = 14x14 cells. */
  gridSize: number
  /** Milliseconds per movement step (lower = faster). */
  tickMs: number
  durationSec: number
  /** If true, the snake wraps around edges instead of dying on wall contact. */
  wrap: boolean
  /** Number of static obstacle cells scattered on the board. Optional, default 0. */
  obstacles?: number
  /** Fractional reduction in tickMs per second of play (0-0.05), makes the game speed up. Optional, default 0. */
  speedRamp?: number
  theme: { bg: string; accent: string; food: string }
  rewardCurve: TapCatchRewardTier[]
  maxScore: number
}

export function validateSnakeConfig(config: SnakeConfig): ConfigValidationResult {
  const errors: string[] = []

  if (!Number.isFinite(config.gridSize) || config.gridSize < 8 || config.gridSize > 20) {
    errors.push('gridSize must be between 8 and 20')
  }
  if (!Number.isFinite(config.tickMs) || config.tickMs < 60 || config.tickMs > 400) {
    errors.push('tickMs must be between 60 and 400')
  }
  if (!Number.isFinite(config.durationSec) || config.durationSec < 15 || config.durationSec > 90) {
    errors.push('durationSec must be between 15 and 90')
  }
  if (typeof config.wrap !== 'boolean') {
    errors.push('wrap must be a boolean')
  }
  if (config.obstacles !== undefined) {
    if (!Number.isFinite(config.obstacles) || config.obstacles < 0 || config.obstacles > 10) {
      errors.push('obstacles must be between 0 and 10')
    }
  }
  if (config.speedRamp !== undefined) {
    if (!Number.isFinite(config.speedRamp) || config.speedRamp < 0 || config.speedRamp > 0.05) {
      errors.push('speedRamp must be between 0 and 0.05 (0-5% speed increase per second)')
    }
  }
  if (!Number.isFinite(config.maxScore) || config.maxScore < 1 || config.maxScore > 100) {
    errors.push('maxScore must be between 1 and 100')
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

// ---------- stack_tower ----------
//
// Classic block-stacker: a block oscillates horizontally above the tower;
// tapping drops it onto the stack, trimming any overhang to the overlap with
// the block below. Missing entirely (no overlap) ends the run. Score is the
// number of blocks successfully placed, scored via the same tiered
// rewardCurve/maxScore shape as tap_catch/snake_run.

export interface StackTowerConfig {
  /** Canvas width in px — also the width of the base block. */
  boardWidth: number
  /** Width in px of the very first moving block (must be less than boardWidth). */
  blockWidth: number
  /** Height in px of each stacked block. */
  blockHeight: number
  /** Horizontal oscillation speed of the moving block, in px/sec. */
  blockSpeed: number
  /** Fractional increase in blockSpeed per block placed (0-0.15). Optional, default 0. */
  speedRamp?: number
  /** If true, a near-perfect placement snaps to full overlap with no trimming. Optional, default false. */
  perfectBonus?: boolean
  theme: { bg: string; accent: string; blockColors: string[] }
  rewardCurve: TapCatchRewardTier[]
  maxScore: number
}

export function validateStackTowerConfig(config: StackTowerConfig): ConfigValidationResult {
  const errors: string[] = []

  if (!Number.isFinite(config.boardWidth) || config.boardWidth < 200 || config.boardWidth > 360) {
    errors.push('boardWidth must be between 200 and 360')
  }
  if (!Number.isFinite(config.blockWidth) || config.blockWidth < 20 || config.blockWidth >= config.boardWidth) {
    errors.push('blockWidth must be at least 20 and less than boardWidth')
  }
  if (!Number.isFinite(config.blockHeight) || config.blockHeight < 16 || config.blockHeight > 40) {
    errors.push('blockHeight must be between 16 and 40')
  }
  if (!Number.isFinite(config.blockSpeed) || config.blockSpeed < 60 || config.blockSpeed > 320) {
    errors.push('blockSpeed must be between 60 and 320')
  }
  if (config.speedRamp !== undefined) {
    if (!Number.isFinite(config.speedRamp) || config.speedRamp < 0 || config.speedRamp > 0.15) {
      errors.push('speedRamp must be between 0 and 0.15 (0-15% speed increase per block placed)')
    }
  }
  if (config.perfectBonus !== undefined && typeof config.perfectBonus !== 'boolean') {
    errors.push('perfectBonus must be a boolean')
  }
  if (!Array.isArray(config.theme?.blockColors) || config.theme.blockColors.length < 1 || config.theme.blockColors.length > 6) {
    errors.push('theme.blockColors must contain between 1 and 6 entries')
  }
  if (!Number.isFinite(config.maxScore) || config.maxScore < 1 || config.maxScore > 100) {
    errors.push('maxScore must be between 1 and 100')
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

// ---------- gomoku ----------
//
// Live 8x8 connect-5 matches are a bespoke engine (lib/gomoku.ts), not a
// generic config-driven template — the catalog row exists only so it can
// share the cover-image / cards UI with the other games.

export type GomokuConfig = Record<string, never>

export function validateGameConfig(template: GameTemplate, config: unknown): ConfigValidationResult {
  if (template === 'tap_catch') return validateTapCatchConfig(config as TapCatchConfig)
  if (template === 'spin_wheel') return validateSpinWheelConfig(config as SpinWheelConfig)
  if (template === 'snake_run') return validateSnakeConfig(config as SnakeConfig)
  if (template === 'stack_tower') return validateStackTowerConfig(config as StackTowerConfig)
  if (template === 'gomoku') return { valid: true, errors: [] }
  return { valid: false, errors: [`Unknown template: ${template}`] }
}
