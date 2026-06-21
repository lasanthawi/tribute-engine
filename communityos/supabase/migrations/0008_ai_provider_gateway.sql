-- Multi-provider AI gateway: admin-managed provider configs (API keys live only in
-- env vars, never in this table) and a log of every generation attempt.

create table if not exists ai_provider_configs (
  id              bigserial primary key,
  provider        text not null check (provider in ('anthropic', 'openai', 'gemini', 'custom')),
  label           text not null,
  model           text not null,
  base_url        text,
  api_key_env_var text not null,
  enabled         boolean not null default true,
  priority        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ai_provider_configs_enabled_priority on ai_provider_configs(enabled, priority);

create table if not exists ai_request_logs (
  id           bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  provider     text not null,
  model        text not null,
  success      boolean not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ai_request_logs_community on ai_request_logs(community_id, created_at desc);
