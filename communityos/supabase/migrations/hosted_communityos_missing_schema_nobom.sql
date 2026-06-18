
-- ============================================================
-- communityos\supabase\migrations\0005_communityos_complete.sql
-- ============================================================

-- CommunityOS complete schema â€” safe to run on any state.
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards.
-- Run this AFTER the root app's 0001_called_it_schema.sql (which creates the users table).

-- ============================================================
-- 0001 tables: core community schema
-- ============================================================

CREATE TABLE IF NOT EXISTS communities (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id            BIGINT NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,
  handle              TEXT,
  description         TEXT,
  telegram_chat_id    BIGINT,
  telegram_invite_url TEXT,
  status              TEXT NOT NULL DEFAULT 'active',
  settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_communities_owner ON communities(owner_id);
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);

CREATE TABLE IF NOT EXISTS community_members (
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  role           TEXT NOT NULL DEFAULT 'member',
  access_status  TEXT NOT NULL DEFAULT 'pending',
  source         TEXT NOT NULL DEFAULT 'direct',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ,
  notes          TEXT,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_user   ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_access ON community_members(community_id, access_status);

-- Surrogate id needed by FK references in platform tables.
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS id BIGSERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS community_members_id_key ON community_members(id);

CREATE TABLE IF NOT EXISTS membership_plans (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  name           TEXT NOT NULL,
  description    TEXT,
  price_cents    INT NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  interval       TEXT NOT NULL DEFAULT 'month',
  benefits       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_plans_community ON membership_plans(community_id, status);

CREATE TABLE IF NOT EXISTS member_subscriptions (
  id                    BIGSERIAL PRIMARY KEY,
  community_id           BIGINT NOT NULL REFERENCES communities(id),
  user_id                BIGINT NOT NULL REFERENCES users(id),
  plan_id                BIGINT REFERENCES membership_plans(id),
  status                 TEXT NOT NULL DEFAULT 'active',
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  payment_provider       TEXT NOT NULL DEFAULT 'manual',
  payment_reference      TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_community ON member_subscriptions(community_id, status);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_user      ON member_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS community_referrals (
  id              BIGSERIAL PRIMARY KEY,
  community_id    BIGINT NOT NULL REFERENCES communities(id),
  referrer_id     BIGINT NOT NULL REFERENCES users(id),
  referee_id      BIGINT REFERENCES users(id),
  referral_code   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'clicked',
  clicks          INT NOT NULL DEFAULT 0,
  revenue_cents   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ,
  UNIQUE (community_id, referral_code)
);
CREATE INDEX IF NOT EXISTS idx_community_referrals_referrer ON community_referrals(community_id, referrer_id);

CREATE TABLE IF NOT EXISTS community_xp_ledger (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  delta          INT NOT NULL,
  entry_type     TEXT NOT NULL,
  ref_user       BIGINT REFERENCES users(id),
  ref_event      BIGINT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_xp_user ON community_xp_ledger(community_id, user_id);

CREATE OR REPLACE VIEW community_user_xp_totals AS
  SELECT community_id, user_id, COALESCE(SUM(delta), 0) AS xp
  FROM community_xp_ledger
  GROUP BY community_id, user_id;

CREATE TABLE IF NOT EXISTS community_rewards (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  criteria       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_rewards_community ON community_rewards(community_id, status);

CREATE TABLE IF NOT EXISTS community_user_rewards (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  reward_id      BIGINT NOT NULL REFERENCES community_rewards(id),
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id, reward_id)
);

CREATE TABLE IF NOT EXISTS community_activity_events (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT REFERENCES users(id),
  event_type     TEXT NOT NULL,
  title          TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_activity ON community_activity_events(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_access_logs (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT REFERENCES users(id),
  action         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_access_logs_community ON telegram_access_logs(community_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_ai_settings (
  community_id       BIGINT PRIMARY KEY REFERENCES communities(id),
  faq_enabled        BOOLEAN NOT NULL DEFAULT false,
  welcome_enabled    BOOLEAN NOT NULL DEFAULT true,
  reports_enabled    BOOLEAN NOT NULL DEFAULT false,
  faq_sources        JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone               TEXT NOT NULL DEFAULT 'helpful',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 0002 tables: platform expansion (all FK issues resolved above)
-- ============================================================

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

CREATE TABLE IF NOT EXISTS payment_products (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  product_type text not null,
  price_stars integer not null default 0,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS telegram_star_invoices (
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

CREATE TABLE IF NOT EXISTS purchases (
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
CREATE INDEX IF NOT EXISTS idx_purchases_community ON purchases(community_id);

CREATE TABLE IF NOT EXISTS subscription_periods (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  member_subscription_id bigint references member_subscriptions(id) on delete cascade,
  purchase_id bigint references purchases(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS renewal_events (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  member_subscription_id bigint references member_subscriptions(id) on delete cascade,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS referral_clicks (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  referral_code text not null,
  telegram_user_id text,
  user_agent text,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks(referral_code);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  referred_user_id bigint references users(id) on delete set null,
  attribution_type text not null,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS revenue_attributions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  referral_id bigint references community_referrals(id) on delete set null,
  purchase_id bigint references purchases(id) on delete cascade,
  revenue_cents integer not null default 0,
  revenue_stars integer not null default 0,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS xp_rules (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  trigger text not null,
  xp_reward integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS badge_definitions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS reward_grants (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  reward_id bigint references community_rewards(id) on delete set null,
  member_id bigint references community_members(id) on delete cascade,
  source text not null default 'rule',
  status text not null default 'granted',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_sources (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  source_type text not null,
  content text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS ai_faq_entries (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  question text not null,
  answer text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  status text not null default 'draft',
  summary text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS community_health_scores (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  score integer not null default 0,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  title text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

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

CREATE TABLE IF NOT EXISTS event_registrations (
  id bigserial primary key,
  event_id bigint references community_events(id) on delete cascade,
  member_id bigint references community_members(id) on delete cascade,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  UNIQUE(event_id, member_id)
);

CREATE TABLE IF NOT EXISTS premium_content (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  product_id bigint references payment_products(id) on delete set null,
  title text not null,
  content text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS consultation_bookings (
  id bigserial primary key,
  community_id bigint references communities(id) on delete cascade,
  product_id bigint references payment_products(id) on delete set null,
  buyer_user_id bigint references users(id) on delete set null,
  starts_at timestamptz,
  status text not null default 'requested',
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS notification_jobs (
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
CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial primary key,
  actor_user_id bigint references users(id) on delete set null,
  community_id bigint references communities(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 0003 tables: referral campaigns
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_campaigns (
  id            bigserial primary key,
  community_id  bigint not null references communities(id) on delete cascade,
  title         text not null,
  reward        text not null default '',
  status        text not null default 'active',
  clicks        integer not null default 0,
  joins         integer not null default 0,
  purchases     integer not null default 0,
  revenue_cents integer not null default 0,
  created_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_referral_campaigns_community ON referral_campaigns(community_id, status);

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- communityos\supabase\migrations\0006_revenue_models.sql
-- ============================================================

-- CommunityOS revenue model completion: products, events, uploads, and event payments.

alter table community_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table telegram_star_invoices
  add column if not exists event_id bigint references community_events(id) on delete set null;

alter table purchases
  add column if not exists event_id bigint references community_events(id) on delete set null;

create index if not exists idx_telegram_star_invoices_event_id on telegram_star_invoices(event_id);
create index if not exists idx_purchases_event_id on purchases(event_id);
create index if not exists idx_payment_products_status on payment_products(community_id, status);
create index if not exists idx_community_events_status on community_events(community_id, status);

insert into storage.buckets (id, name, public)
values ('communityos-assets', 'communityos-assets', false)
on conflict (id) do nothing;


-- ============================================================
-- communityos\supabase\migrations\0007_account_subscriptions_access.sql
-- ============================================================

-- CommunityOS account home, onboarding state, subscription lifecycle, and access operations.

alter table users
  add column if not exists communityos_onboarded_at timestamptz,
  add column if not exists communityos_last_revenue_model text;

alter table telegram_star_invoices
  add column if not exists invoice_kind text not null default 'plan',
  add column if not exists plan_id bigint references membership_plans(id) on delete set null,
  add column if not exists period_interval text;

alter table purchases
  add column if not exists plan_id bigint references membership_plans(id) on delete set null;

alter table telegram_join_requests
  add column if not exists decided_by bigint references users(id) on delete set null,
  add column if not exists message text;

create table if not exists community_balance_ledger (
  id bigserial primary key,
  community_id bigint not null references communities(id) on delete cascade,
  user_id bigint references users(id) on delete set null,
  purchase_id bigint references purchases(id) on delete set null,
  entry_type text not null,
  stars_delta integer not null default 0,
  cents_delta integer not null default 0,
  status text not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_balance_ledger_community on community_balance_ledger(community_id, created_at desc);
create index if not exists idx_telegram_join_requests_status on telegram_join_requests(community_id, status);
create index if not exists idx_telegram_star_invoices_plan on telegram_star_invoices(plan_id);
create index if not exists idx_purchases_plan on purchases(plan_id);
