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
