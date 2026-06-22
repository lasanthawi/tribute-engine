-- Platform commission: a single configurable take-rate applied to all Stars
-- revenue, enforced at the point purchases are credited to publisher balances.

create table if not exists platform_settings (
  id integer primary key default 1,
  commission_rate_bps integer not null default 500,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);

insert into platform_settings (id, commission_rate_bps)
values (1, 500)
on conflict (id) do nothing;

create table if not exists platform_commission_ledger (
  id bigserial primary key,
  community_id bigint not null references communities(id) on delete cascade,
  purchase_id bigint references purchases(id) on delete set null,
  user_id bigint references users(id) on delete set null,
  gross_stars integer not null default 0,
  commission_stars integer not null default 0,
  commission_rate_bps integer not null default 0,
  commission_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_commission_ledger_community on platform_commission_ledger(community_id, created_at desc);
