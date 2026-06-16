-- Community OS: member profiles, events, RSVPs
-- Shares the `users` and `referrals` tables from the main called-it project.

CREATE TABLE IF NOT EXISTS community_profiles (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio          TEXT,
  role_title   TEXT        NOT NULL DEFAULT 'Member',
  status       TEXT        NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive', 'banned')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_events (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT,
  event_at    TIMESTAMPTZ NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming', 'live', 'done', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   INTEGER     NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

CREATE OR REPLACE VIEW community_member_stats AS
SELECT status, COUNT(*) AS member_count
FROM   community_profiles
GROUP  BY status;
