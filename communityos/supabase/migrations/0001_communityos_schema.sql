-- CommunityOS beta schema.
-- Reuses shared `users` from tribute-engine and keeps financial/growth state append-only.

CREATE TABLE communities (
  id                  BIGSERIAL PRIMARY KEY,
  owner_id            BIGINT NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,
  handle              TEXT,
  description         TEXT,
  telegram_chat_id    BIGINT,
  telegram_invite_url TEXT,
  status              TEXT NOT NULL DEFAULT 'active', -- active|paused|archived
  settings            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_owner ON communities(owner_id);
CREATE INDEX idx_communities_status ON communities(status);

CREATE TABLE community_members (
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  role           TEXT NOT NULL DEFAULT 'member', -- owner|admin|member
  access_status  TEXT NOT NULL DEFAULT 'pending', -- pending|granted|revoked|expired|failed
  source         TEXT NOT NULL DEFAULT 'direct', -- direct|referral|import|challengehub
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ,
  notes          TEXT,
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_access ON community_members(community_id, access_status);

CREATE TABLE membership_plans (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  name           TEXT NOT NULL,
  description    TEXT,
  price_cents    INT NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  interval       TEXT NOT NULL DEFAULT 'month', -- free|month|year|lifetime
  benefits       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active', -- active|paused|archived
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_membership_plans_community ON membership_plans(community_id, status);

CREATE TABLE member_subscriptions (
  id                    BIGSERIAL PRIMARY KEY,
  community_id           BIGINT NOT NULL REFERENCES communities(id),
  user_id                BIGINT NOT NULL REFERENCES users(id),
  plan_id                BIGINT REFERENCES membership_plans(id),
  status                 TEXT NOT NULL DEFAULT 'active', -- trialing|active|past_due|expired|cancelled
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  payment_provider       TEXT NOT NULL DEFAULT 'manual',
  payment_reference      TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_subscriptions_community ON member_subscriptions(community_id, status);
CREATE INDEX idx_member_subscriptions_user ON member_subscriptions(user_id);

CREATE TABLE community_referrals (
  id              BIGSERIAL PRIMARY KEY,
  community_id    BIGINT NOT NULL REFERENCES communities(id),
  referrer_id     BIGINT NOT NULL REFERENCES users(id),
  referee_id      BIGINT REFERENCES users(id),
  referral_code   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'clicked', -- clicked|joined|activated|purchased
  clicks          INT NOT NULL DEFAULT 0,
  revenue_cents   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ,
  UNIQUE (community_id, referral_code)
);
CREATE INDEX idx_community_referrals_referrer ON community_referrals(community_id, referrer_id);

CREATE TABLE community_xp_ledger (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  delta          INT NOT NULL,
  entry_type     TEXT NOT NULL, -- join|referral|purchase|event|challenge|manual|reward
  ref_user       BIGINT REFERENCES users(id),
  ref_event      BIGINT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_xp_user ON community_xp_ledger(community_id, user_id);

CREATE VIEW community_user_xp_totals AS
  SELECT community_id, user_id, COALESCE(SUM(delta), 0) AS xp
  FROM community_xp_ledger
  GROUP BY community_id, user_id;

CREATE TABLE community_rewards (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  type           TEXT NOT NULL, -- badge|certificate|digital_product|premium_access|sponsor|manual
  title          TEXT NOT NULL,
  description    TEXT,
  criteria       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_rewards_community ON community_rewards(community_id, status);

CREATE TABLE community_user_rewards (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  reward_id      BIGINT NOT NULL REFERENCES community_rewards(id),
  claimed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id, reward_id)
);

CREATE TABLE community_activity_events (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT REFERENCES users(id),
  event_type     TEXT NOT NULL,
  title          TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_community_activity ON community_activity_events(community_id, created_at DESC);

CREATE TABLE telegram_access_logs (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id),
  user_id        BIGINT REFERENCES users(id),
  action         TEXT NOT NULL, -- grant|revoke|sync|invite_link
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_access_logs_community ON telegram_access_logs(community_id, created_at DESC);

CREATE TABLE community_ai_settings (
  community_id       BIGINT PRIMARY KEY REFERENCES communities(id),
  faq_enabled        BOOLEAN NOT NULL DEFAULT false,
  welcome_enabled    BOOLEAN NOT NULL DEFAULT true,
  reports_enabled    BOOLEAN NOT NULL DEFAULT false,
  faq_sources        JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone               TEXT NOT NULL DEFAULT 'helpful',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
