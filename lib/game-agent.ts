// VOTE LEAGUE — self-evolving mini-game publisher: design + automated test gate
//
// `designNewGame` asks Claude for a brand-new tap_catch or spin_wheel config
// (gated on ANTHROPIC_API_KEY — throws if unset, the cron handler decides
// what to do). `testGameConfig` is pure validation + simulation that runs
// with no external dependencies, so every proposal — AI-authored or
// hand-authored — passes through the same automated gate before publishing.

import {
  GameTemplate,
  TapCatchConfig,
  SpinWheelConfig,
  SnakeConfig,
  validateGameConfig,
  computeTapRewardFromCurve,
  computeRewardFromCurve,
} from './game-templates'
import { CatalogGame } from './games-catalog'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1'

export interface ProposedGame {
  slug: string
  template: GameTemplate
  title: string
  description: string
  icon: string
  config: TapCatchConfig | SpinWheelConfig | SnakeConfig
  /** Short visual brief for cover art generation. */
  imagePrompt: string
  /** One-line announcement copy for the official channel. */
  promoCopy: string
  /** Palette accent hex for the procedural cover fallback, e.g. "#6c5ce7". */
  accentColor: string
}

export interface DesignContext {
  /** Existing catalog games (any status) — used so the new design is distinct. */
  existingGames: CatalogGame[]
  /** A "creativity lever" nudging theme/mechanic variety run-to-run. */
  creativeBrief: string
}

const SYSTEM_PROMPT = `You are the game designer for VOTE LEAGUE, a crypto-prediction Telegram Mini App.
You design small reward mini-games that slot into an existing catalog. Each game is either:
- "tap_catch": a reflex game where objects travel across the canvas and are tapped for points, with a tiered reward
  curve based on final score. The engine supports several mechanical levers — use them to make each game feel
  meaningfully different, not just a recolor:
  - "direction": "down" | "up" | "left" | "right" — which way objects travel (falling, rising, or drifting sideways).
  - "hazards": an optional array of penalty objects (same shape as "objects") mixed into the spawn pool — tapping
    one costs the player points instead of earning them. Great for "avoid the bad ones" tension.
  - "hazardPenalty": points lost per hazard tap (0-10, default 1).
  - "speedRamp": fractional speed increase per second (0-0.2) — makes the game escalate in intensity over time.
  Pick a distinct combination of these (e.g. a different direction AND hazards, or a high speedRamp) so the game
  plays differently from existing tap_catch games, not just looks different.
- "spin_wheel": a wheel with 3-10 weighted segments, each awarding points, tickets, and/or coins.
- "snake_run": a classic grid-snake game — the player steers (swipe/arrows) a snake around a square grid to eat
  glowing food orbs, growing longer and scoring a point per orb, for a fixed duration. Reward is a tiered curve
  over the final score (food eaten), same shape as tap_catch's rewardCurve/maxScore. Mechanical levers:
  - "gridSize": 8-20 — board dimension (gridSize x gridSize cells). Bigger boards feel roomier, smaller boards
    feel frantic.
  - "tickMs": 60-400 — milliseconds per movement step; lower is faster/harder.
  - "wrap": boolean — true lets the snake wrap around edges instead of dying on wall contact (more forgiving).
  - "obstacles": 0-10 — static blocks scattered on the board to dodge.
  - "speedRamp": 0-0.05 — fractional reduction in tickMs per second of play, making the game accelerate.
  - "theme": { bg, accent, food } hex colors for the board background, snake body, and food orb.
  Pick a distinct combination (e.g. small fast grid with wrap-around vs large slow grid with many obstacles) so
  each snake_run game plays differently.

Hard constraints (a separate automated gate enforces these — design within them):
- tap_catch: durationSec 10-60, spawnMinMs >= 200 and <= spawnMaxMs, 1-6 objects, hazards 0-4, hazardPenalty 0-10,
  speedRamp 0-0.2, maxScore 1-200, rewardCurve max points <= 300.
- spin_wheel: 3-10 segments, weights positive, rewardPoints <= 300 per segment, and the weighted expected value per spin <= 60 points
  (treat 1 ticket ~= 50 points and 1 coin ~= 10 points when estimating).
- snake_run: gridSize 8-20, tickMs 60-400, durationSec 15-90, obstacles 0-10, speedRamp 0-0.05, maxScore 1-100,
  rewardCurve max points <= 300.
- The slug must be a short lowercase-with-hyphens identifier not already used by an existing game.
- Theme AND mechanic should feel distinct from existing games (different icon, color, travel direction/hazards, and concept).

Respond with ONLY a JSON object matching this TypeScript shape, no prose, no markdown fences:
{
  "slug": string,
  "template": "tap_catch" | "spin_wheel" | "snake_run",
  "title": string,
  "description": string,
  "icon": string, // a single emoji
  "config": { ...template-specific config, using the mechanical levers above... },
  "imagePrompt": string, // short cinematic visual brief for cover art — describe a dynamic scene, lighting, and mood
  "promoCopy": string, // one-line announcement for players
  "accentColor": string // hex color, e.g. "#6c5ce7"
}`

/**
 * Asks Claude to design a new mini-game config. Throws if ANTHROPIC_API_KEY
 * is unset or the model response isn't valid JSON — callers should treat
 * either as "no new design this cycle" and skip gracefully.
 */
export async function designNewGame(context: DesignContext): Promise<ProposedGame> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const existingSummary = context.existingGames
    .map((g) => `- ${g.slug} (${g.template}, status=${g.status}): ${g.title} — ${g.description}`)
    .join('\n')

  const userPrompt = `Existing catalog games:\n${existingSummary || '(none)'}\n\nCreative brief for this design: ${context.creativeBrief}\n\nDesign one new mini-game now.`

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
  }
  const json = await response.json()
  const text = json?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Anthropic response missing text content')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Anthropic response did not contain a JSON object')

  return JSON.parse(jsonMatch[0]) as ProposedGame
}

export interface GameTestResult {
  passed: boolean
  errors: string[]
  /** Estimated average points awarded per play, for catalog-balance review. */
  estimatedAvgPointsPerPlay: number
}

const MAX_EXPECTED_POINTS_PER_PLAY = 60

/** Monte Carlo estimate of average reward points per play for a tap_catch config. */
function simulateTapCatchEv(config: TapCatchConfig, trials = 5000): number {
  let total = 0
  for (let i = 0; i < trials; i++) {
    // Assume scores cluster around 1/3 of maxScore (a casual player), with
    // some spread — representative enough for a guardrail estimate.
    const score = Math.max(0, Math.round((Math.random() + Math.random()) * (config.maxScore / 3)))
    total += computeTapRewardFromCurve(score, config)
  }
  return total / trials
}

/** Monte Carlo estimate of average reward points per play for a snake_run config. */
function simulateSnakeRunEv(config: SnakeConfig, trials = 5000): number {
  let total = 0
  for (let i = 0; i < trials; i++) {
    // Assume scores cluster around 1/3 of maxScore (a casual player), with
    // some spread — representative enough for a guardrail estimate.
    const score = Math.max(0, Math.round((Math.random() + Math.random()) * (config.maxScore / 3)))
    total += computeRewardFromCurve(score, config.maxScore, config.rewardCurve)
  }
  return total / trials
}

function simulateSpinWheelEv(config: SpinWheelConfig): number {
  const totalWeight = config.segments.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight <= 0) return 0
  return config.segments.reduce((sum, s) => {
    const points = s.rewardPoints + s.rewardTickets * 50 + s.rewardCoins * 10
    return sum + (s.weight / totalWeight) * points
  }, 0)
}

/**
 * Automated test gate: schema validation (via validateGameConfig),
 * uniqueness against the existing catalog, required-field checks for
 * promo/image generation, and a Monte Carlo expected-value simulation.
 * A failing result means the proposal must NOT be published.
 */
export function testGameConfig(proposal: ProposedGame, existingGames: CatalogGame[]): GameTestResult {
  const errors: string[] = []

  const schema = validateGameConfig(proposal.template, proposal.config)
  errors.push(...schema.errors)

  if (!proposal.slug || !/^[a-z0-9-]+$/.test(proposal.slug)) {
    errors.push('slug must be lowercase letters, digits, and hyphens')
  }
  if (existingGames.some((g) => g.slug === proposal.slug)) {
    errors.push(`slug "${proposal.slug}" already exists in the catalog`)
  }
  if (!proposal.title?.trim()) errors.push('title is required')
  if (!proposal.description?.trim()) errors.push('description is required')
  if (!proposal.icon?.trim()) errors.push('icon is required')
  if (!proposal.imagePrompt?.trim()) errors.push('imagePrompt is required')
  if (!proposal.promoCopy?.trim()) errors.push('promoCopy is required')

  let estimatedAvgPointsPerPlay = 0
  if (proposal.template === 'tap_catch') {
    estimatedAvgPointsPerPlay = simulateTapCatchEv(proposal.config as TapCatchConfig)
  } else if (proposal.template === 'spin_wheel') {
    estimatedAvgPointsPerPlay = simulateSpinWheelEv(proposal.config as SpinWheelConfig)
  } else if (proposal.template === 'snake_run') {
    estimatedAvgPointsPerPlay = simulateSnakeRunEv(proposal.config as SnakeConfig)
  }
  if (estimatedAvgPointsPerPlay > MAX_EXPECTED_POINTS_PER_PLAY) {
    errors.push(`estimated average points per play (${estimatedAvgPointsPerPlay.toFixed(1)}) exceeds cap of ${MAX_EXPECTED_POINTS_PER_PLAY}`)
  }

  return { passed: errors.length === 0, errors, estimatedAvgPointsPerPlay }
}
