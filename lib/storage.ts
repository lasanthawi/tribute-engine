// VOTE LEAGUE — Supabase Storage helper for autonomously-generated game cover art

import { supabase } from './supabase'

const BUCKET = 'game-covers'

/**
 * Uploads a PNG cover image for `slug` to the `game-covers` storage bucket
 * and returns its public URL, or null if the upload fails (caller falls
 * back to a procedural SVG cover).
 */
export async function uploadGameCover(slug: string, png: Buffer): Promise<string | null> {
  const path = `${slug}-${Date.now()}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(path, png, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) {
    console.error('uploadGameCover error:', error)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}
