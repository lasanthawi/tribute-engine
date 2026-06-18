-- CALLED IT - lock down public tables
--
-- Supabase flagged the project because tables in the public schema had Row
-- Level Security disabled. The app performs database writes through server-side
-- API routes using the service role key, so public API roles should not have
-- direct table access unless a future migration adds narrow policies.

DO $$
DECLARE
  table_name TEXT;
  table_names TEXT[] := ARRAY[
    'users',
    'referrals',
    'squads',
    'squad_members',
    'seasons',
    'rounds',
    'predictions',
    'points_ledger',
    'ticket_ledger',
    'coins_ledger',
    'perks_ledger',
    'coin_purchases',
    'quest_definitions',
    'user_quest_progress',
    'achievement_definitions',
    'user_achievements',
    'minigame_plays',
    'gomoku_matches',
    'gomoku_moves',
    'games'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
