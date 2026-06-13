-- CALLED IT — Achievements + Profile

ALTER TABLE users ADD COLUMN best_streak INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE achievement_definitions (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT NOT NULL,
  criteria_type TEXT NOT NULL,    -- first_vote | first_win | streak_reached | total_correct | perfect_day | league_tier
  criteria_value INT,
  criteria_text TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
  id                          BIGSERIAL PRIMARY KEY,
  user_id                     BIGINT NOT NULL REFERENCES users(id),
  achievement_definition_id   BIGINT NOT NULL REFERENCES achievement_definitions(id),
  unlocked_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_definition_id)
);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- Seed achievements
INSERT INTO achievement_definitions (code, title, description, icon, criteria_type, criteria_value, criteria_text, sort_order)
VALUES
  ('first_call', 'First Call', 'Cast your first vote', '🎯', 'first_vote', NULL, NULL, 1),
  ('first_win', 'First Win', 'Get your first correct call', '🏆', 'first_win', NULL, NULL, 2),
  ('streak_3', 'Warming Up', 'Reach a 3-day streak', '🔥', 'streak_reached', 3, NULL, 3),
  ('streak_7', 'On Fire', 'Reach a 7-day streak', '🔥', 'streak_reached', 7, NULL, 4),
  ('streak_30', 'Unstoppable', 'Reach a 30-day streak', '🔥', 'streak_reached', 30, NULL, 5),
  ('correct_10', 'Sharp Shooter', 'Get 10 correct calls', '🎯', 'total_correct', 10, NULL, 6),
  ('correct_50', 'Master Predictor', 'Get 50 correct calls', '🧠', 'total_correct', 50, NULL, 7),
  ('correct_100', 'Oracle', 'Get 100 correct calls', '🔮', 'total_correct', 100, NULL, 8),
  ('perfect_day', 'Perfect Day', 'Get 3+ correct calls in a single day', '⭐', 'perfect_day', 3, NULL, 9),
  ('league_silver', 'Silver League', 'Reach the Silver league', '🥈', 'league_tier', NULL, 'Silver', 10),
  ('league_gold', 'Gold League', 'Reach the Gold league', '🥇', 'league_tier', NULL, 'Gold', 11),
  ('league_platinum', 'Platinum League', 'Reach the Platinum league', '💎', 'league_tier', NULL, 'Platinum', 12),
  ('league_diamond', 'Diamond League', 'Reach the Diamond league', '💠', 'league_tier', NULL, 'Diamond', 13);
