import { sb } from './supabase'

export const ASSET_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'communityos-assets'
let bucketReady: Promise<void> | null = null

export interface UploadedAsset {
  path: string
  url: string | null
  fileName: string
  mimeType: string
  size: number
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'audio/mpeg',
])

function extensionFor(fileName: string) {
  const ext = fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return ext ? `.${ext}` : ''
}

function isMissingBucketError(error: any) {
  const message = String(error?.message || error?.error || '').toLowerCase()
  const statusCode = Number(error?.statusCode || error?.status || 0)
  return statusCode === 404 || message.includes('bucket') && (message.includes('not found') || message.includes('not exist') || message.includes('not available'))
}

async function createAssetBucket() {
  const { error } = await sb.storage.createBucket(ASSET_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: Array.from(allowedMimeTypes),
  })
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw error
  }
}

export async function ensureAssetBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await sb.storage.getBucket(ASSET_BUCKET)
      if (!error) return
      if (!isMissingBucketError(error)) throw error
      await createAssetBucket()
    })().catch((error) => {
      bucketReady = null
      throw error
    })
  }
  return bucketReady
}

export function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid file payload')
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

export async function uploadCommunityAsset(
  communityId: number,
  input: { fileName: string; mimeType: string; dataUrl: string; assetType: 'cover' | 'delivery' }
): Promise<UploadedAsset> {
  const { mimeType, buffer } = parseDataUrl(input.dataUrl)
  if (mimeType !== input.mimeType) throw new Error('File type mismatch')
  if (!allowedMimeTypes.has(mimeType)) throw new Error('Unsupported file type')
  if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB')

  const safeName = input.fileName.replace(/[^\w.\-]+/g, '-').slice(-80) || `asset${extensionFor(input.fileName)}`
  const path = `${communityId}/${input.assetType}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  await ensureAssetBucket()
  let { error } = await sb.storage.from(ASSET_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  })
  if (error && isMissingBucketError(error)) {
    bucketReady = null
    await ensureAssetBucket()
    ;({ error } = await sb.storage.from(ASSET_BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    }))
  }
  if (error) throw error

  return {
    path,
    url: await signedAssetUrl(path, input.assetType === 'cover' ? 86400 : 900),
    fileName: input.fileName,
    mimeType,
    size: buffer.byteLength,
  }
}

export async function signedAssetUrl(path?: string | null, expiresIn = 900): Promise<string | null> {
  if (!path) return null
  const { data, error } = await sb.storage.from(ASSET_BUCKET).createSignedUrl(path, expiresIn)
  if (error && isMissingBucketError(error)) return null
  if (error) return null
  return data?.signedUrl ?? null
}
