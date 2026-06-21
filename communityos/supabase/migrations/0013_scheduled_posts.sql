-- Auto-posting: recurring re-shares of a single plan/product/event, sent by
-- the cron in pages/api/cron/auto-post.ts using the same content builder as
-- the manual Share button (lib/share-content.ts).

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id             BIGSERIAL PRIMARY KEY,
  community_id   BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  target_type    TEXT NOT NULL CHECK (target_type IN ('plan', 'product', 'event')),
  target_id      BIGINT NOT NULL,
  interval_hours INT NOT NULL DEFAULT 168,
  next_run_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (community_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, next_run_at);
