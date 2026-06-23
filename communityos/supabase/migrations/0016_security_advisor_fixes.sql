-- Supabase Security Advisor remediation: these two tables are platform-internal
-- and only ever accessed via the service-role client (which bypasses RLS
-- regardless of policies), so enabling RLS with no policies blocks all
-- anon/authenticated API access without affecting current app behavior.
alter table platform_settings enable row level security;
alter table platform_commission_ledger enable row level security;

-- Make the view run with the querying role's privileges instead of the
-- view owner's, resolving the "Security Definer View" advisory. The view
-- is currently unused by app code, so this is a no-behavior-change fix.
alter view community_user_xp_totals set (security_invoker = true);
