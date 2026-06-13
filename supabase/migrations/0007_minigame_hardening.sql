-- VOTE LEAGUE - mini-game safety rails
-- Keep client/API bugs from writing invalid reward rows, and make the daily
-- spin limit resilient to duplicate concurrent requests.

ALTER TABLE minigame_plays
  ADD CONSTRAINT minigame_plays_game_type_check
  CHECK (game_type IN ('tap', 'spin'));

ALTER TABLE minigame_plays
  ADD CONSTRAINT minigame_plays_score_check
  CHECK (
    (game_type = 'tap' AND score IS NOT NULL AND score BETWEEN 0 AND 60)
    OR
    (game_type = 'spin' AND score IS NULL)
  );

ALTER TABLE minigame_plays
  ADD CONSTRAINT minigame_plays_reward_nonnegative_check
  CHECK (reward_points >= 0 AND reward_tickets >= 0 AND reward_coins >= 0);

CREATE UNIQUE INDEX idx_minigame_plays_one_spin_per_day
  ON minigame_plays(user_id, played_date)
  WHERE game_type = 'spin';
