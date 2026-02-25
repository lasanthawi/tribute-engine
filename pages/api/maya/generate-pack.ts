import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase'
import { generatePhotoPack } from '@/lib/maya-content'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { theme, count = 15 } = req.body

    if (!theme) {
      return res.status(400).json({ error: 'Theme is required' })
    }

    // Verify authorization
    const authHeader = req.headers.authorization
    const adminSecret = process.env.ADMIN_SECRET || 'admin-secret'
    
    if (authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log(`Generating ${count} photos for theme: ${theme}...`)
    const photos = await generatePhotoPack(theme, count)

    // Store pack in database
    const { data: pack, error: packError } = await supabase
      .from('maya_photo_packs')
      .insert({
        theme: theme,
        photo_count: photos.length,
        status: 'ready',
      })
      .select()
      .single()

    if (packError) {
      throw new Error(`Failed to create pack: ${packError.message}`)
    }

    // Store individual photos
    const photoRecords = photos.map((photo, index) => ({
      pack_id: pack.id,
      image_url: photo.url,
      description: photo.description,
      order_index: index,
    }))

    const { error: photosError } = await supabase
      .from('maya_photos')
      .insert(photoRecords)

    if (photosError) {
      throw new Error(`Failed to store photos: ${photosError.message}`)
    }

    return res.status(200).json({
      success: true,
      pack: {
        id: pack.id,
        theme: theme,
        photoCount: photos.length,
        photos: photos.map(p => ({ url: p.url })),
      },
    })
  } catch (error: any) {
    console.error('Pack generation error:', error)
    return res.status(500).json({
      error: 'Failed to generate photo pack',
      details: error.message,
    })
  }
}
