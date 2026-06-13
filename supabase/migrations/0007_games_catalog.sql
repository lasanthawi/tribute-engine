-- VOTE LEAGUE — dynamic mini-games catalog (cover images + config-driven game engines)

CREATE TABLE games (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  template          TEXT NOT NULL,                  -- 'tap_catch' | 'spin_wheel'
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  icon              TEXT NOT NULL DEFAULT '🎮',
  config            JSONB NOT NULL,                 -- template-specific params, see lib/game-templates.ts
  cover_image_url   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',  -- draft | testing | published | retired
  max_plays_per_day INT NOT NULL DEFAULT 3,
  version           INT NOT NULL DEFAULT 1,
  parent_id         BIGINT REFERENCES games(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

CREATE INDEX idx_games_status ON games(status);

-- minigame_plays now references games by slug rather than a fixed 'tap'|'spin' enum
ALTER TABLE minigame_plays RENAME COLUMN game_type TO game_slug;
DROP INDEX IF EXISTS idx_minigame_plays_user_date;
CREATE INDEX idx_minigame_plays_user_date ON minigame_plays(user_id, game_slug, played_date);

-- Seed the two existing games as published rows, configs matching prior hardcoded behavior
INSERT INTO games (slug, template, title, description, icon, config, cover_image_url, status, max_plays_per_day, version, published_at)
VALUES
(
  'tap',
  'tap_catch',
  'Coin Catcher',
  'Tap falling BTC/ETH/TON coins for 30 seconds',
  '🪙',
  '{
    "durationSec": 30,
    "spawnMinMs": 600,
    "spawnMaxMs": 900,
    "objects": [
      { "id": "BTC", "label": "₿", "color": "#F7931A", "weight": 1 },
      { "id": "ETH", "label": "Ξ", "color": "#627EEA", "weight": 1 },
      { "id": "TON", "label": "◆", "color": "#0098EA", "weight": 1 }
    ],
    "rewardCurve": [
      { "minScore": 0, "points": 0 },
      { "minScore": 1, "points": 5 },
      { "minScore": 5, "points": 10 },
      { "minScore": 10, "points": 15 },
      { "minScore": 15, "points": 20 },
      { "minScore": 20, "points": 30 },
      { "minScore": 30, "points": 40 }
    ],
    "maxScore": 60,
    "theme": { "bg": "#0b0f1a", "accent": "#6c5ce7" }
  }'::jsonb,
  '/games/tap-cover.svg',
  'published',
  3,
  1,
  now()
),
(
  'spin',
  'spin_wheel',
  'Daily Spin',
  'One free spin every day for bonus rewards',
  '🎡',
  '{
    "segments": [
      { "label": "10 pts", "weight": 30, "rewardPoints": 10, "rewardTickets": 0, "rewardCoins": 0 },
      { "label": "20 pts", "weight": 25, "rewardPoints": 20, "rewardTickets": 0, "rewardCoins": 0 },
      { "label": "50 pts", "weight": 18, "rewardPoints": 50, "rewardTickets": 0, "rewardCoins": 0 },
      { "label": "5 coins", "weight": 12, "rewardPoints": 0, "rewardTickets": 0, "rewardCoins": 5 },
      { "label": "100 pts", "weight": 10, "rewardPoints": 100, "rewardTickets": 0, "rewardCoins": 0 },
      { "label": "1 ticket", "weight": 4, "rewardPoints": 0, "rewardTickets": 1, "rewardCoins": 0 },
      { "label": "Jackpot 250", "weight": 1, "rewardPoints": 250, "rewardTickets": 0, "rewardCoins": 0 }
    ]
  }'::jsonb,
  '/games/spin-cover.svg',
  'published',
  1,
  1,
  now()
);
