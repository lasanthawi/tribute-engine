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
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string))
}

/** Procedural SVG cover, returned as a data: URI — no filesystem or network access required. */
export function proceduralCoverSvg(input: CoverImageInput): string {
  const accent = input.accentColor || '#6c5ce7'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1f33"/>
      <stop offset="100%" stop-color="#0b0f1a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect width="640" height="360" fill="url(#glow)"/>
  <circle cx="320" cy="150" r="80" fill="${accent}" opacity="0.18"/>
  <text x="50%" y="170" font-family="sans-serif" font-size="84" text-anchor="middle">${escapeXml(input.icon)}</text>
  <text x="50%" y="290" font-family="sans-serif" font-size="44" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(input.title)}</text>
  <text x="50%" y="320" font-family="sans-serif" font-size="18" font-weight="600" fill="#a3a8c2" text-anchor="middle">${escapeXml(input.description)}</text>
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
