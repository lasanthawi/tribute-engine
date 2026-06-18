-- CommunityOS account home, onboarding state, subscription lifecycle, and access operations.

alter table users
  add column if not exists communityos_onboarded_at timestamptz,
  add column if not exists communityos_last_revenue_model text;

alter table telegram_star_invoices
  add column if not exists invoice_kind text not null default 'plan',
  add column if not exists plan_id bigint references membership_plans(id) on delete set null,
  add column if not exists period_interval text;

alter table purchases
  add column if not exists plan_id bigint references membership_plans(id) on delete set null;

alter table telegram_join_requests
  add column if not exists decided_by bigint references users(id) on delete set null,
  add column if not exists message text;

create table if not exists community_balance_ledger (
  id bigserial primary key,
  community_id bigint not null references communities(id) on delete cascade,
  user_id bigint references users(id) on delete set null,
  purchase_id bigint references purchases(id) on delete set null,
  entry_type text not null,
  stars_delta integer not null default 0,
  cents_delta integer not null default 0,
  status text not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_community_balance_ledger_community on community_balance_ledger(community_id, created_at desc);
create index if not exists idx_telegram_join_requests_status on telegram_join_requests(community_id, status);
create index if not exists idx_telegram_star_invoices_plan on telegram_star_invoices(plan_id);
create index if not exists idx_purchases_plan on purchases(plan_id);
