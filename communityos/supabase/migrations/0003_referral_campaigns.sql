-- CommunityOS referral campaigns.
-- Campaign-level container that the per-member rows in `community_referrals`
-- and the click/attribution tables roll up into. Safe to rerun.

create table if not exists referral_campaigns (
  id            bigserial primary key,
  community_id  bigint not null references communities(id) on delete cascade,
  title         text not null,
  reward        text not null default '',
  status        text not null default 'active', -- draft|active|paused
  clicks        integer not null default 0,
  joins         integer not null default 0,
  purchases     integer not null default 0,
  revenue_cents integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_referral_campaigns_community on referral_campaigns(community_id, status);
