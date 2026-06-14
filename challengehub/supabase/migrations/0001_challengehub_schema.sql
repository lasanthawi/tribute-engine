-- 1:1 extension of shared users table (does not modify users)
CREATE TABLE challengehub_profiles (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id),
  xp         INT NOT NULL DEFAULT 0,   -- denormalized cache; xp_ledger is source of truth
  level      INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenges (
  id           BIGSERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  cover_url    TEXT,
  start_date   TIMESTAMPTZ NOT NULL,
  end_date     TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'upcoming', -- upcoming|active|completed|cancelled
  creator_id   BIGINT NOT NULL REFERENCES users(id),
  rules        TEXT,
  rewards      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_challenges_status ON challenges(status);

CREATE TABLE daily_tasks (
  id           BIGSERIAL PRIMARY KEY,
  challenge_id BIGINT NOT NULL REFERENCES challenges(id),
  day          INT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  xp_reward    INT NOT NULL DEFAULT 20,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, day)
);

CREATE TABLE challenge_members (
  user_id      BIGINT NOT NULL REFERENCES users(id),
  challenge_id BIGINT NOT NULL REFERENCES challenges(id),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'active', -- active|completed|dropped
  PRIMARY KEY (user_id, challenge_id)
);
CREATE INDEX idx_challenge_members_challenge ON challenge_members(challenge_id);

CREATE TABLE task_submissions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  task_id          BIGINT NOT NULL REFERENCES daily_tasks(id),
  evidence_type    TEXT NOT NULL,    -- text|screenshot|link
  evidence_content TEXT,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,
  UNIQUE (user_id, task_id)
);
CREATE INDEX idx_task_submissions_user ON task_submissions(user_id);

-- XP ledger, mirrors points_ledger's append-only pattern
CREATE TABLE xp_ledger (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  delta         INT NOT NULL,
  entry_type    TEXT NOT NULL, -- join_challenge|daily_task|invite_friend|finish_challenge|referral_bonus
  ref_challenge BIGINT REFERENCES challenges(id),
  ref_user      BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_ledger_user ON xp_ledger(user_id);
CREATE INDEX idx_xp_ledger_challenge ON xp_ledger(ref_challenge);

CREATE VIEW user_xp_totals AS
  SELECT user_id, COALESCE(SUM(delta),0) AS xp FROM xp_ledger GROUP BY user_id;

CREATE TABLE rewards (
  id           BIGSERIAL PRIMARY KEY,
  challenge_id BIGINT REFERENCES challenges(id), -- null = global reward
  type         TEXT NOT NULL, -- badge|certificate|digital_product|premium_access|cash|sponsor
  title        TEXT NOT NULL,
  description  TEXT,
  criteria     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_rewards (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  reward_id  BIGINT NOT NULL REFERENCES rewards(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_id)
);
