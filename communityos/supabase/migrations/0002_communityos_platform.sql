-- CommunityOS platform expansion.
-- Safe to run after 0001_communityos_schema.sql; tables are additive only.

create table if not exists platform_admins (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  role text not null default 'operator',
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists telegram_chats (
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

create table if not exists telegram_access_grants (
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

create table if not exists telegram_invite_links (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  telegram_chat_id bigint references telegram_chats(id) on delete cascade,
  member_id bigint references community_members(id) on delete set null,
  invite_link text not null,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists telegram_join_requests (
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

create table if not exists access_policy_rules (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  name text not null,
  trigger text not null,
  action text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists payment_products (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  product_type text not null,
  price_stars integer not null default 0,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists telegram_star_invoices (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  product_id bigint references payment_products(id) on delete set null,
  buyer_user_id bigint references users(id) on delete set null,
  payload text not null unique,
  stars integer not null,
  status text not null default 'created',
  telegram_charge_id text,
  provider_charge_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists purchases (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  buyer_user_id bigint references users(id) on delete set null,
  product_id bigint references payment_products(id) on delete set null,
  invoice_id bigint references telegram_star_invoices(id) on delete set null,
  amount_stars integer not null default 0,
  amount_cents integer not null default 0,
  status text not null default 'pending',
  source text not null default 'telegram_stars',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists subscription_periods (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  member_subscription_id bigint references member_subscriptions(id) on delete cascade,
  purchase_id bigint references purchases(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists renewal_events (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  member_subscription_id bigint references member_subscriptions(id) on delete cascade,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists referral_clicks (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  referral_code text not null,
  telegram_user_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists referral_attributions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  referred_user_id bigint references users(id) on delete set null,
  attribution_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists revenue_attributions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  purchase_id bigint references purchases(id) on delete cascade,
  revenue_cents integer not null default 0,
  revenue_stars integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists xp_rules (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  trigger text not null,
  xp_reward integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists badge_definitions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists reward_grants (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  reward_id bigint references community_rewards(id) on delete set null,
  member_id bigint references community_members(id) on delete cascade,
  source text not null default 'rule',
  status text not null default 'granted',
  created_at timestamptz not null default now()
);

create table if not exists ai_knowledge_sources (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  source_type text not null,
  content text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists ai_faq_entries (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  question text not null,
  answer text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists weekly_reports (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  status text not null default 'draft',
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists community_health_scores (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  score integer not null default 0,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_suggestions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists community_events (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  event_type text not null,
  starts_at timestamptz not null,
  price_stars integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists event_registrations (
  id bigserial primary key,
  event_id bigint references community_events(id) on delete cascade,
  member_id bigint references community_members(id) on delete cascade,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique(event_id, member_id)
);

create table if not exists premium_content (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  product_id bigint references payment_products(id) on delete set null,
  title text not null,
  content text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists consultation_bookings (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  product_id bigint references payment_products(id) on delete set null,
  buyer_user_id bigint references users(id) on delete set null,
  starts_at timestamptz,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

create table if not exists notification_jobs (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  channel text not null default 'telegram',
  recipient_user_id bigint references users(id) on delete set null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists audit_events (
  id bigserial primary key,
  actor_user_id bigint references users(id) on delete set null,
  community_id bigint references communities(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_access_grants_community on telegram_access_grants(community_id);
create index if not exists idx_purchases_community on purchases(community_id);
create index if not exists idx_referral_clicks_code on referral_clicks(referral_code);
create index if not exists idx_notification_jobs_status on notification_jobs(status);
