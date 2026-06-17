-- community_members uses a composite PK (community_id, user_id) but several
-- tables added in 0002 reference community_members(id) which does not exist.
-- This migration adds the surrogate id column and recreates the four affected
-- tables so the schema is consistent and 0002 tables all exist.

-- Step 1: add surrogate id to community_members
ALTER TABLE community_members
  ADD COLUMN IF NOT EXISTS id BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS community_members_id_key ON community_members (id);

-- Step 2: ensure telegram_chats exists (may be absent if 0002 rolled back)
CREATE TABLE IF NOT EXISTS telegram_chats (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  telegram_chat_id text not null,
  title text not null,
  handle text,
  chat_type text not null default 'group',
  bot_status text not null default 'not_connected',
  access_mode text not null default 'join_request',
  active_members integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(community_id, telegram_chat_id)
);

-- Step 3: ensure community_events exists (needed by event_registrations FK)
CREATE TABLE IF NOT EXISTS community_events (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  event_type text not null,
  starts_at timestamptz not null,
  price_stars integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- Step 4: ensure community_rewards exists before reward_grants FK
-- (already in 0001 but guard against edge-case rollback)
CREATE TABLE IF NOT EXISTS community_rewards (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- Step 5: drop and recreate the four tables that failed in 0002
DROP TABLE IF EXISTS event_registrations;
DROP TABLE IF EXISTS reward_grants;
DROP TABLE IF EXISTS telegram_invite_links;
DROP TABLE IF EXISTS telegram_access_grants;

CREATE TABLE telegram_access_grants (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  member_id bigint references community_members(id) on delete cascade,
  telegram_chat_id bigint references telegram_chats(id) on delete set null,
  access_status text not null default 'pending',
  source text not null default 'system',
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_access_grants_community ON telegram_access_grants(community_id);

CREATE TABLE telegram_invite_links (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  telegram_chat_id bigint references telegram_chats(id) on delete cascade,
  member_id bigint references community_members(id) on delete set null,
  invite_link text not null,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE TABLE reward_grants (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  reward_id bigint references community_rewards(id) on delete set null,
  member_id bigint references community_members(id) on delete cascade,
  source text not null default 'rule',
  status text not null default 'granted',
  created_at timestamptz not null default now()
);

CREATE TABLE event_registrations (
  id bigserial primary key,
  event_id bigint references community_events(id) on delete cascade,
  member_id bigint references community_members(id) on delete cascade,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  UNIQUE(event_id, member_id)
);
