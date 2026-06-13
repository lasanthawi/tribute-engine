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
  validateGameConfig,
  computeTapRewardFromCurve,
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
  config: TapCatchConfig | SpinWheelConfig
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
- "tap_catch": a 10-60 second reflex game where falling objects are tapped for points, with a tiered reward curve based on final score.
- "spin_wheel": a wheel with 3-10 weighted segments, each awarding points, tickets, and/or coins.

Hard constraints (a separate automated gate enforces these — design within them):
- tap_catch: durationSec 10-60, spawnMinMs >= 200 and <= spawnMaxMs, 1-6 objects, maxScore 1-200, rewardCurve max points <= 300.
- spin_wheel: 3-10 segments, weights positive, rewardPoints <= 300 per segment, and the weighted expected value per spin <= 60 points
  (treat 1 ticket ~= 50 points and 1 coin ~= 10 points when estimating).
- The slug must be a short lowercase-with-hyphens identifier not already used by an existing game.
- Theme should feel distinct from existing games (different icon, color, and mechanic flavor).

Respond with ONLY a JSON object matching this TypeScript shape, no prose, no markdown fences:
{
  "slug": string,
  "template": "tap_catch" | "spin_wheel",
  "title": string,
  "description": string,
  "icon": string, // a single emoji
  "config": { ...template-specific config... },
  "imagePrompt": string, // short visual brief for cover art
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
  }
  if (estimatedAvgPointsPerPlay > MAX_EXPECTED_POINTS_PER_PLAY) {
    errors.push(`estimated average points per play (${estimatedAvgPointsPerPlay.toFixed(1)}) exceeds cap of ${MAX_EXPECTED_POINTS_PER_PLAY}`)
  }

  return { passed: errors.length === 0, errors, estimatedAvgPointsPerPlay }
}
