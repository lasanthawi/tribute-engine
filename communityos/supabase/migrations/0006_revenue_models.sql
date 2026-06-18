-- CommunityOS revenue model completion: products, events, uploads, and event payments.

alter table community_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table telegram_star_invoices
  add column if not exists event_id bigint references community_events(id) on delete set null;

alter table purchases
  add column if not exists event_id bigint references community_events(id) on delete set null;

create index if not exists idx_telegram_star_invoices_event_id on telegram_star_invoices(event_id);
create index if not exists idx_purchases_event_id on purchases(event_id);
create index if not exists idx_payment_products_status on payment_products(community_id, status);
create index if not exists idx_community_events_status on community_events(community_id, status);

insert into storage.buckets (id, name, public)
values ('communityos-assets', 'communityos-assets', false)
on conflict (id) do nothing;
