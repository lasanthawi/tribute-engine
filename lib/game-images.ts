// VOTE LEAGUE — mini-game cover art generation
//
// If OPENAI_API_KEY is set, generates cover art via the OpenAI Images API and
// uploads it to Supabase Storage. Otherwise falls back to a procedural SVG
// (gradient + icon + title, matching the style of the hand-authored
// tap-cover.svg / spin-cover.svg), returned as a data: URI so it needs no
// filesystem or storage access — works on read-only serverless deployments.

import { uploadGameCover } from './storage'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = 'https://api.openai.com/v1'

export interface CoverImageInput {
  slug: string
  title: string
  description: string
  icon: string
  /** Short visual brief for the image model, e.g. "neon retro arcade, falling gold coins". */
  imagePrompt: string
  /** Palette accent hex, used by the procedural fallback (e.g. "#6c5ce7"). */
  accentColor?: string
  /** tap_catch objects/hazards — rendered as a dynamic scene of moving pieces with motion trails. */
  objects?: { label: string; color: string }[]
  /** tap_catch travel direction — controls the orientation of motion trails. */
  direction?: 'down' | 'up' | 'left' | 'right'
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

/** Deterministic per-slug PRNG (mulberry32) so a regenerated cover looks the same. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Trail offset vector (dx, dy per step, opposite the travel direction) for motion-streak rendering. */
function trailVector(direction?: CoverImageInput['direction']): [number, number] {
  switch (direction) {
    case 'up':
      return [0, 28]
    case 'left':
      return [28, 0]
    case 'right':
      return [-28, 0]
    default:
      return [0, -28]
  }
}

/**
 * Procedural "cinematic" SVG cover, returned as a data: URI — no filesystem or
 * network access required. Renders an atmospheric gradient scene with glow,
 * scattered particles, and (for tap_catch games) the game's own objects as
 * moving pieces with motion trails along their travel direction.
 */
export function proceduralCoverSvg(input: CoverImageInput): string {
  const accent = input.accentColor || '#6c5ce7'
  const rand = seededRandom(input.slug)
  const [tx, ty] = trailVector(input.direction)

  const particles = Array.from({ length: 24 }, () => {
    const x = Math.round(rand() * 640)
    const y = Math.round(rand() * 360)
    const r = (rand() * 1.6 + 0.4).toFixed(1)
    const o = (rand() * 0.5 + 0.15).toFixed(2)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o}"/>`
  }).join('\n  ')

  const pieces = (input.objects ?? []).slice(0, 5)
  const scene = pieces
    .map((obj, i) => {
      const cx = Math.round(80 + rand() * 480)
      const cy = Math.round(60 + rand() * 200)
      const size = Math.round(22 + rand() * 26)
      const trails = [3, 2, 1]
        .map((step) => {
          const ox = cx + tx * step
          const oy = cy + ty * step
          const op = (0.22 - step * 0.06).toFixed(2)
          return `<circle cx="${ox}" cy="${oy}" r="${size}" fill="${obj.color}" opacity="${op}"/>`
        })
        .join('\n    ')
      return `<g opacity="${(0.85 - i * 0.08).toFixed(2)}">
    ${trails}
    <circle cx="${cx}" cy="${cy}" r="${size}" fill="${obj.color}"/>
    <text x="${cx}" y="${cy + 1}" font-family="sans-serif" font-size="${Math.round(size * 0.9)}" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">${escapeXml(obj.label)}</text>
  </g>`
    })
    .join('\n  ')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1f33"/>
      <stop offset="100%" stop-color="#0b0f1a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="32%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b0f1a" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0b0f1a" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect width="640" height="360" fill="url(#glow)"/>
  ${particles}
  <circle cx="320" cy="145" r="90" fill="${accent}" opacity="0.16"/>
  ${scene}
  <text x="50%" y="160" font-family="sans-serif" font-size="78" text-anchor="middle" dominant-baseline="middle">${escapeXml(input.icon)}</text>
  <rect width="640" height="140" y="220" fill="url(#vignette)"/>
  <text x="50%" y="295" font-family="sans-serif" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(input.title)}</text>
  <text x="50%" y="325" font-family="sans-serif" font-size="18" font-weight="600" fill="#a3a8c2" text-anchor="middle">${escapeXml(input.description)}</text>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Calls the OpenAI Images API for a PNG cover, returns raw bytes. Throws on any failure. */
async function generateOpenAiCover(input: CoverImageInput): Promise<Buffer> {
  const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: `Mobile game cover art, 16:9, vibrant crypto/Telegram mini-app aesthetic. ${input.imagePrompt}. No text, no UI elements.`,
      size: '1024x1024',
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI image generation failed: ${response.status} ${await response.text()}`)
  }
  const json = await response.json()
  const b64 = json?.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI image response missing b64_json')
  return Buffer.from(b64, 'base64')
}

/**
 * Returns a cover image URL for the given game: an OpenAI-generated image
 * uploaded to Supabase Storage if OPENAI_API_KEY is set (falling back on
 * any error), otherwise a procedural SVG data: URI.
 */
export async function generateCoverImage(input: CoverImageInput): Promise<string> {
  if (OPENAI_API_KEY) {
    try {
      const png = await generateOpenAiCover(input)
      const url = await uploadGameCover(input.slug, png)
      if (url) return url
    } catch (error) {
      console.error('generateCoverImage: OpenAI path failed, falling back to procedural SVG:', error)
    }
  }
  return proceduralCoverSvg(input)
}
