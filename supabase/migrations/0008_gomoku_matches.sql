-- VOTE LEAGUE - live Gomoku rooms
-- 8x8 connect-5 matches for remote two-player play.

CREATE TABLE gomoku_matches (
  id             BIGSERIAL PRIMARY KEY,
  share_code     TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'waiting',
  creator_id     BIGINT NOT NULL REFERENCES users(id),
  opponent_id    BIGINT REFERENCES users(id),
  x_user_id      BIGINT NOT NULL REFERENCES users(id),
  o_user_id      BIGINT REFERENCES users(id),
  current_turn   TEXT NOT NULL DEFAULT 'X',
  winner_mark    TEXT,
  winning_cells  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,

  CONSTRAINT gomoku_matches_status_check
    CHECK (status IN ('waiting', 'active', 'settled', 'cancelled')),
  CONSTRAINT gomoku_matches_turn_check
    CHECK (current_turn IN ('X', 'O')),
  CONSTRAINT gomoku_matches_winner_check
    CHECK (winner_mark IS NULL OR winner_mark IN ('X', 'O', 'draw')),
  CONSTRAINT gomoku_matches_distinct_players_check
    CHECK (opponent_id IS NULL OR opponent_id <> creator_id)
);

CREATE INDEX idx_gomoku_matches_share_code ON gomoku_matches(share_code);
CREATE INDEX idx_gomoku_matches_players ON gomoku_matches(creator_id, opponent_id, status);

CREATE TABLE gomoku_moves (
  id          BIGSERIAL PRIMARY KEY,
  match_id    BIGINT NOT NULL REFERENCES gomoku_matches(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  mark        TEXT NOT NULL,
  row_index   INT NOT NULL,
  col_index   INT NOT NULL,
  move_number INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT gomoku_moves_mark_check CHECK (mark IN ('X', 'O')),
  CONSTRAINT gomoku_moves_row_check CHECK (row_index BETWEEN 0 AND 7),
  CONSTRAINT gomoku_moves_col_check CHECK (col_index BETWEEN 0 AND 7),
  UNIQUE (match_id, row_index, col_index),
  UNIQUE (match_id, move_number)
);

CREATE INDEX idx_gomoku_moves_match ON gomoku_moves(match_id, move_number);
