// VOTE LEAGUE — mini-games catalog access (published games, lookup by slug)

import { supabase } from './supabase'
import { GameTemplate, GameStatus, TapCatchConfig, SpinWheelConfig } from './game-templates'

export interface CatalogGame {
  id: number
  slug: string
  template: GameTemplate
  title: string
  description: string
  icon: string
  config: TapCatchConfig | SpinWheelConfig
  coverImageUrl: string | null
  status: GameStatus
  maxPlaysPerDay: number
  version: number
}

function toCatalogGame(row: {
  id: number
  slug: string
  template: string
  title: string
  description: string
  icon: string
  config: unknown
  cover_image_url: string | null
  status: string
  max_plays_per_day: number
  version: number
}): CatalogGame {
  return {
    id: row.id,
    slug: row.slug,
    template: row.template as GameTemplate,
    title: row.title,
    description: row.description,
    icon: row.icon,
    config: row.config as TapCatchConfig | SpinWheelConfig,
    coverImageUrl: row.cover_image_url,
    status: row.status as GameStatus,
    maxPlaysPerDay: row.max_plays_per_day,
    version: row.version,
  }
}

/** All games currently visible to players, ordered for display. */
export async function getPublishedGames(): Promise<CatalogGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version')
    .eq('status', 'published')
    .order('published_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCatalogGame)
}

/** A single game by slug, regardless of status (used by the play endpoint and admin tools). */
export async function getGameBySlug(slug: string): Promise<CatalogGame | null> {
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return toCatalogGame(data)
}
