import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

const BUCKET = 'task-evidence'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
}

export const config = {
  api: { bodyParser: { sizeLimit: '7mb' } },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await requireUser(req, res)
  if (userId === null) return

  const { dataUrl } = req.body ?? {}
  if (typeof dataUrl !== 'string') return res.status(400).json({ error: 'Missing dataUrl' })

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid data URL' })

  const [, mime, base64] = match
  const ext = EXT_BY_MIME[mime]
  if (!ext) return res.status(400).json({ error: 'Unsupported file type' })

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength > MAX_BYTES) return res.status(413).json({ error: 'File too large' })

  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mime })
    if (error) throw error

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path)
    res.status(200).json({ url: publicUrl.publicUrl })
  } catch (error) {
    console.error('uploads/index error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
}
