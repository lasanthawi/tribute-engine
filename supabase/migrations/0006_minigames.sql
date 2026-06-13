-- VOTE LEAGUE — Mini-games (tap game + spin wheel)

CREATE TABLE minigame_plays (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  game_type     TEXT NOT NULL,           -- 'tap' | 'spin'
  played_date   DATE NOT NULL,           -- UTC date, used for daily limit checks
  score         INT,                     -- tap game: taps/score; null for spin
  reward_points INT NOT NULL DEFAULT 0,
  reward_tickets INT NOT NULL DEFAULT 0,
  reward_coins  INT NOT NULL DEFAULT 0,
  reward_label  TEXT,                    -- e.g. 'spin_segment_3' for client animation/debug
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_minigame_plays_user_date ON minigame_plays(user_id, game_type, played_date);
