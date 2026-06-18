-- ============================================================
-- communityos\supabase\migrations\0005_communityos_complete.sql
-- ============================================================

-- CommunityOS complete schema Ã¢â‚¬â€ safe to run on any state.
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
