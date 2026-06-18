CREATE TABLE IF NOT EXISTS platform_admins (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  role text not null default 'operator',
  created_at timestamptz not null default now(),
  unique(user_id)
);

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

-- These four tables previously referenced community_members(id) which
-- didn't exist. The ALTER TABLE above adds the id column first.
CREATE TABLE IF NOT EXISTS telegram_access_grants (
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

CREATE TABLE IF NOT EXISTS telegram_invite_links (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  telegram_chat_id bigint references telegram_chats(id) on delete cascade,
  member_id bigint references community_members(id) on delete set null,
  invite_link text not null,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS telegram_join_requests (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  telegram_chat_id bigint references telegram_chats(id) on delete cascade,
  telegram_user_id text not null,
  username text,
  status text not null default 'pending',
  referral_code text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

CREATE TABLE IF NOT EXISTS access_policy_rules (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  name text not null,
  trigger text not null,
  action text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
