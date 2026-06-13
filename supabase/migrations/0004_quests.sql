-- CALLED IT — Daily/Weekly Quests

CREATE TABLE quest_definitions (
  id                  BIGSERIAL PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  type                TEXT NOT NULL,            -- daily | weekly
  goal_type           TEXT NOT NULL,            -- vote_count | correct_count | asset_vote | streak_maintain | login
  goal_asset          TEXT,                     -- BTC | ETH | TON (for asset_vote)
  goal_target         INT NOT NULL,
  reward_type         TEXT NOT NULL,            -- points | coins | tickets | perk
  reward_amount       INT NOT NULL,
  reward_perk_type    TEXT,                     -- confidence_boost | streak_freeze (for reward_type = perk)
  reward_type_2       TEXT,                     -- optional compound reward
  reward_amount_2     INT,
  reward_perk_type_2  TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_quest_progress (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id),
  quest_definition_id  BIGINT NOT NULL REFERENCES quest_definitions(id),
  period_key           TEXT NOT NULL,           -- 'YYYY-MM-DD' for daily, 'YYYY-Www' for weekly
  progress             INT NOT NULL DEFAULT 0,
  completed_at         TIMESTAMPTZ,
  claimed_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_definition_id, period_key)
);
CREATE INDEX idx_user_quest_progress_user ON user_quest_progress(user_id, period_key);

-- Seed quests
INSERT INTO quest_definitions (code, title, description, type, goal_type, goal_asset, goal_target, reward_type, reward_amount, reward_perk_type, reward_type_2, reward_amount_2, reward_perk_type_2)
VALUES
  ('daily_vote_3', 'Triple Vote', 'Cast 3 votes today', 'daily', 'vote_count', NULL, 3, 'coins', 10, NULL, NULL, NULL, NULL),
  ('daily_correct_1', 'Sharp Eye', 'Get 1 correct call today', 'daily', 'correct_count', NULL, 1, 'coins', 5, NULL, NULL, NULL, NULL),
  ('weekly_vote_15', 'Vote Machine', 'Cast 15 votes this week', 'weekly', 'vote_count', NULL, 15, 'tickets', 1, NULL, 'coins', 50, NULL),
  ('weekly_streak', 'Hot Streak', 'Maintain your streak all week', 'weekly', 'streak_maintain', NULL, 7, 'perk', 1, 'confidence_boost', NULL, NULL, NULL);
