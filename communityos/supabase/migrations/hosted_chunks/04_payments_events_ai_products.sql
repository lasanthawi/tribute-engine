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
