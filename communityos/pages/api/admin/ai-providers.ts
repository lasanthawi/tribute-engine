import { NextApiRequest, NextApiResponse } from 'next'
import { requireUser } from '@/lib/api-auth'
import { isPlatformAdmin } from '@/lib/admin'
import {
  AiProviderConfigRow,
  createAiProviderConfig,
  deleteAiProviderConfig,
  listAiProviderConfigs,
  updateAiProviderConfig,
} from '@/lib/ai-providers'

const PROVIDERS = ['anthropic', 'openai', 'gemini', 'custom'] as const

function toDto(row: AiProviderConfigRow) {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    model: row.model,
    baseUrl: row.base_url,
    apiKeyEnvVar: row.api_key_env_var,
    enabled: row.enabled,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireUser(req, res)
  if (userId === null) return

  try {
    if (!(await isPlatformAdmin(userId))) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      const providers = await listAiProviderConfigs()
      return res.status(200).json({ providers: providers.map(toDto) })
    }

    if (req.method === 'POST') {
      const { provider, label, model, baseUrl, apiKeyEnvVar, enabled, priority } = req.body ?? {}
      if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: 'Invalid provider' })
      if (!label || typeof label !== 'string') return res.status(400).json({ error: 'label is required' })
      if (!model || typeof model !== 'string') return res.status(400).json({ error: 'model is required' })
      if (!apiKeyEnvVar || typeof apiKeyEnvVar !== 'string') return res.status(400).json({ error: 'apiKeyEnvVar is required' })

      const created = await createAiProviderConfig({
        provider,
        label,
        model,
        baseUrl: typeof baseUrl === 'string' ? baseUrl : null,
        apiKeyEnvVar,
        enabled: typeof enabled === 'boolean' ? enabled : true,
        priority: typeof priority === 'number' ? priority : 0,
      })
      return res.status(201).json({ provider: toDto(created) })
    }

    if (req.method === 'PATCH') {
      const { id, label, model, baseUrl, apiKeyEnvVar, enabled, priority } = req.body ?? {}
      if (typeof id !== 'number') return res.status(400).json({ error: 'id is required' })

      const updated = await updateAiProviderConfig(id, {
        label: typeof label === 'string' ? label : undefined,
        model: typeof model === 'string' ? model : undefined,
        baseUrl: baseUrl === null || typeof baseUrl === 'string' ? baseUrl : undefined,
        apiKeyEnvVar: typeof apiKeyEnvVar === 'string' ? apiKeyEnvVar : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
        priority: typeof priority === 'number' ? priority : undefined,
      })
      return res.status(200).json({ provider: toDto(updated) })
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id)
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
      await deleteAiProviderConfig(id)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('admin/ai-providers error:', error)
    res.status(500).json({ error: 'Internal error' })
  }
}
