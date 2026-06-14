// VOTE LEAGUE — mini-games catalog access (published games, lookup by slug)

import { supabase } from './supabase'
import { GameTemplate, GameStatus, TapCatchConfig, SpinWheelConfig, SnakeConfig } from './game-templates'

export interface CatalogGame {
  id: number
  slug: string
  template: GameTemplate
  title: string
  description: string
  icon: string
  config: TapCatchConfig | SpinWheelConfig | SnakeConfig
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
    config: row.config as TapCatchConfig | SpinWheelConfig | SnakeConfig,
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

/** Every game row regardless of status — used for uniqueness checks and admin tooling. */
export async function getAllGames(): Promise<CatalogGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version')
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCatalogGame)
}

/** Games with a given status (e.g. 'published', 'retired'). */
export async function listGamesByStatus(status: GameStatus): Promise<CatalogGame[]> {
  const { data, error } = await supabase
    .from('games')
    .select('id, slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version')
    .eq('status', status)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCatalogGame)
}

export interface NewGameInput {
  slug: string
  template: GameTemplate
  title: string
  description: string
  icon: string
  config: TapCatchConfig | SpinWheelConfig | SnakeConfig
  coverImageUrl: string | null
  maxPlaysPerDay: number
  status: GameStatus
  parentId?: number | null
  version?: number
}

/** Inserts a new game row (any status). Returns the created row. */
export async function createGame(input: NewGameInput): Promise<CatalogGame> {
  const { data, error } = await supabase
    .from('games')
    .insert({
      slug: input.slug,
      template: input.template,
      title: input.title,
      description: input.description,
      icon: input.icon,
      config: input.config,
      cover_image_url: input.coverImageUrl,
      max_plays_per_day: input.maxPlaysPerDay,
      status: input.status,
      parent_id: input.parentId ?? null,
      version: input.version ?? 1,
      published_at: input.status === 'published' ? new Date().toISOString() : null,
    })
    .select('id, slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version')
    .single()
  if (error) throw error
  return toCatalogGame(data)
}

/** Sets a game's lifecycle status by id. Stamps `published_at` when transitioning to 'published'. */
export async function setGameStatus(id: number, status: GameStatus): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (status === 'published') update.published_at = new Date().toISOString()
  const { error } = await supabase.from('games').update(update).eq('id', id)
  if (error) throw error
}
