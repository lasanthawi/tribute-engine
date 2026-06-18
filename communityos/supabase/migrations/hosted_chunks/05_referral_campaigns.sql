CREATE TABLE IF NOT EXISTS referral_campaigns (
  id            bigserial primary key,
  community_id  bigint not null references communities(id) on delete cascade,
  title         text not null,
  reward        text not null default '',
  status        text not null default 'active',
  clicks        integer not null default 0,
  joins         integer not null default 0,
  purchases     integer not null default 0,
  revenue_cents integer not null default 0,
  created_at    timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_referral_campaigns_community ON referral_campaigns(community_id, status);

NOTIFY pgrst, 'reload schema';


-- ============================================================
