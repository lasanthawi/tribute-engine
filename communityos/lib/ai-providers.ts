import { sb } from './supabase'

export interface AiProviderConfigRow {
  id: number
  provider: 'anthropic' | 'openai' | 'gemini' | 'custom'
  label: string
  model: string
  base_url: string | null
  api_key_env_var: string
  enabled: boolean
  priority: number
  created_at: string
  updated_at: string
}

function requireApiKey(cfg: AiProviderConfigRow): string {
  const key = process.env[cfg.api_key_env_var]
  if (!key) throw new Error(`Missing env var ${cfg.api_key_env_var} for AI provider "${cfg.label}"`)
  return key
}

async function callAnthropic(cfg: AiProviderConfigRow, prompt: string): Promise<string> {
  const apiKey = requireApiKey(cfg)
  const baseUrl = (cfg.base_url || 'https://api.anthropic.com').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`)
  const data = await res.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error('Anthropic response missing text content')
  return text
}

async function callOpenAi(cfg: AiProviderConfigRow, prompt: string): Promise<string> {
  const apiKey = requireApiKey(cfg)
  const baseUrl = (cfg.base_url || 'https://api.openai.com').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('OpenAI response missing message content')
  return text
}

async function callGemini(cfg: AiProviderConfigRow, prompt: string): Promise<string> {
  const apiKey = requireApiKey(cfg)
  const baseUrl = (cfg.base_url || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })
  if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('Gemini response missing text content')
  return text
}

// Assumes an OpenAI-compatible chat-completions shape, the most common
// convention for self-hosted/compatible gateways.
async function callCustom(cfg: AiProviderConfigRow, prompt: string): Promise<string> {
  const apiKey = requireApiKey(cfg)
  if (!cfg.base_url) throw new Error(`Custom provider "${cfg.label}" is missing base_url`)
  const baseUrl = cfg.base_url.replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Custom provider request failed: ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('Custom provider response missing message content')
  return text
}

const adapters: Record<AiProviderConfigRow['provider'], (cfg: AiProviderConfigRow, prompt: string) => Promise<string>> = {
  anthropic: callAnthropic,
  openai: callOpenAi,
  gemini: callGemini,
  custom: callCustom,
}

async function logAiRequest(communityId: number | null, provider: string, model: string, success: boolean) {
  const { error } = await sb.from('ai_request_logs').insert({ community_id: communityId, provider, model, success })
  if (error) console.error('logAiRequest failed:', error)
}

// Tries every enabled provider in ascending priority order, falling through to
// the next on any failure (misconfigured env var, network error, bad response
// shape). Throws only if every configured provider fails or none are configured.
export async function generateAiText(prompt: string, opts: { communityId?: number | null } = {}): Promise<string> {
  const { data, error } = await sb
    .from('ai_provider_configs')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true })
  if (error) throw error

  const configs = (data ?? []) as AiProviderConfigRow[]
  const communityId = opts.communityId ?? null

  for (const cfg of configs) {
    try {
      const text = await adapters[cfg.provider](cfg, prompt)
      await logAiRequest(communityId, cfg.provider, cfg.model, true)
      return text
    } catch (error) {
      console.error(`AI provider "${cfg.label}" (${cfg.provider}) failed:`, error)
      await logAiRequest(communityId, cfg.provider, cfg.model, false)
    }
  }

  throw new Error('No AI provider available')
}

export interface UpsertAiProviderConfigInput {
  provider: AiProviderConfigRow['provider']
  label: string
  model: string
  baseUrl?: string | null
  apiKeyEnvVar: string
  enabled?: boolean
  priority?: number
}

export async function listAiProviderConfigs(): Promise<AiProviderConfigRow[]> {
  const { data, error } = await sb.from('ai_provider_configs').select('*').order('priority', { ascending: true })
  if (error) throw error
  return (data ?? []) as AiProviderConfigRow[]
}

export async function createAiProviderConfig(input: UpsertAiProviderConfigInput): Promise<AiProviderConfigRow> {
  const { data, error } = await sb
    .from('ai_provider_configs')
    .insert({
      provider: input.provider,
      label: input.label,
      model: input.model,
      base_url: input.baseUrl ?? null,
      api_key_env_var: input.apiKeyEnvVar,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AiProviderConfigRow
}

export interface UpdateAiProviderConfigInput {
  label?: string
  model?: string
  baseUrl?: string | null
  apiKeyEnvVar?: string
  enabled?: boolean
  priority?: number
}

export async function updateAiProviderConfig(id: number, input: UpdateAiProviderConfigInput): Promise<AiProviderConfigRow> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.label !== undefined) updates.label = input.label
  if (input.model !== undefined) updates.model = input.model
  if (input.baseUrl !== undefined) updates.base_url = input.baseUrl
  if (input.apiKeyEnvVar !== undefined) updates.api_key_env_var = input.apiKeyEnvVar
  if (input.enabled !== undefined) updates.enabled = input.enabled
  if (input.priority !== undefined) updates.priority = input.priority

  const { data, error } = await sb.from('ai_provider_configs').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data as AiProviderConfigRow
}

export async function deleteAiProviderConfig(id: number): Promise<void> {
  const { error } = await sb.from('ai_provider_configs').delete().eq('id', id)
  if (error) throw error
}
