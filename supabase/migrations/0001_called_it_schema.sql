-- CALLED IT — Phase 1 schema
-- Points & tickets are financial-style state: append-only ledgers are the
-- source of truth. Do not store a mutable balance as source of truth.

-- Players
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        TEXT,
  ton_address     TEXT,              -- via TON Connect, nullable early
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  streak_count    INT NOT NULL DEFAULT 0,
  streak_last_day DATE
);

-- Referral graph (1-level MVP; self-referential supports multi later)
CREATE TABLE referrals (
  id           BIGSERIAL PRIMARY KEY,
  referrer_id  BIGINT NOT NULL REFERENCES users(id),
  referee_id   BIGINT NOT NULL UNIQUE REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | activated
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);

-- Squads (schema-ready, Phase 2)
CREATE TABLE squads (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  captain_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE squad_members (
  squad_id  BIGINT NOT NULL REFERENCES squads(id),
  user_id   BIGINT NOT NULL REFERENCES users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, user_id)
);

-- Seasons
CREATE TABLE seasons (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL,            -- 'Season 0'
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at   TIMESTAMPTZ,             -- null = open-ended (the FOMO window)
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Rounds
CREATE TABLE rounds (
  id          BIGSERIAL PRIMARY KEY,
  season_id   BIGINT NOT NULL REFERENCES seasons(id),
  asset       TEXT NOT NULL,          -- 'BTC' | 'ETH' | 'TON'
  kind        TEXT NOT NULL,          -- 'hourly' | 'main_daily'
  state       TEXT NOT NULL DEFAULT 'SCHEDULED',
  open_at     TIMESTAMPTZ NOT NULL,
  lock_at     TIMESTAMPTZ NOT NULL,
  resolve_at  TIMESTAMPTZ NOT NULL,
  strike      NUMERIC,                -- captured at lock
  close       NUMERIC,                -- captured at resolve
  outcome     TEXT,                   -- 'UP' | 'DOWN' | 'VOID'
  base_reward INT NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rounds_state ON rounds(state);
CREATE INDEX idx_rounds_asset_kind ON rounds(asset, kind);

-- Predictions
CREATE TABLE predictions (
  id            BIGSERIAL PRIMARY KEY,
  round_id      BIGINT NOT NULL REFERENCES rounds(id),
  user_id       BIGINT NOT NULL REFERENCES users(id),
  side          TEXT NOT NULL,        -- 'UP' | 'DOWN'
  confidence    INT NOT NULL DEFAULT 0,   -- staked points
  is_correct    BOOLEAN,              -- null until settled
  points_earned INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)          -- one prediction per round per user
);
CREATE INDEX idx_predictions_user ON predictions(user_id);

-- Append-only points ledger (source of truth for balances)
CREATE TABLE points_ledger (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  delta       INT NOT NULL,           -- +/-
  entry_type  TEXT NOT NULL,          -- prediction_win | stake | stake_return |
                                      -- streak_bonus | daily_login |
                                      -- referral_bonus | referral_override | refund
  ref_round   BIGINT REFERENCES rounds(id),
  ref_user    BIGINT REFERENCES users(id),  -- for referral entries
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON points_ledger(user_id);

-- Ticket grants / spends (mirror pattern, keeps audit trail)
CREATE TABLE ticket_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  delta      INT NOT NULL,            -- +5 daily grant, -1 per prediction
  reason     TEXT NOT NULL,           -- daily_grant | prediction | referral_reward
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_ledger_user ON ticket_ledger(user_id);

-- Materialized balance view (convenience; ledger remains truth)
CREATE VIEW user_balances AS
  SELECT u.id AS user_id,
         COALESCE(SUM(pl.delta),0)  AS points,
         COALESCE(SUM(tl.delta),0)  AS tickets
  FROM users u
  LEFT JOIN points_ledger pl ON pl.user_id = u.id
  LEFT JOIN ticket_ledger tl ON tl.user_id = u.id
  GROUP BY u.id;
