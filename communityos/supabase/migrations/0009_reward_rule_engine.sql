-- Reward rule engine: structured triggers on xp_rules plus an idempotency
-- ledger so a rule grants XP at most once per user per occurrence milestone.

ALTER TABLE xp_rules
  ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('member_joined', 'referral_joined', 'referral_activated', 'purchase_completed', 'event_registered', 'manual')),
  ADD COLUMN IF NOT EXISTS trigger_count INT NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS xp_rule_grants (
  id               BIGSERIAL PRIMARY KEY,
  community_id     BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  rule_id          BIGINT NOT NULL REFERENCES xp_rules(id) ON DELETE CASCADE,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  occurrence_count INT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, user_id, occurrence_count)
);

CREATE INDEX IF NOT EXISTS idx_xp_rule_grants_community ON xp_rule_grants(community_id);
