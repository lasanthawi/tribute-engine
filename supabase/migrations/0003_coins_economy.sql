-- CALLED IT — Coins economy (Telegram Stars purchases, perks, redemptions)
-- Same append-only ledger pattern as points_ledger / ticket_ledger.

-- Coin grants / spends
CREATE TABLE coins_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  delta      INT NOT NULL,            -- +/-
  entry_type TEXT NOT NULL,           -- purchase | referral_bonus | redeem_points |
                                       -- redeem_ticket | redeem_perk | refund
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coins_ledger_user ON coins_ledger(user_id);

-- Consumable perk grants / spends (confidence boosts, streak freezes, ...)
CREATE TABLE perks_ledger (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  perk_type  TEXT NOT NULL,           -- confidence_boost | streak_freeze
  delta      INT NOT NULL,            -- +1 grant (redeem), -1 consume
  reason     TEXT NOT NULL,           -- redeem | consume | refund
  ref_round  BIGINT REFERENCES rounds(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_perks_ledger_user ON perks_ledger(user_id, perk_type);

-- Audit trail for Telegram Stars purchases (idempotency via telegram_charge_id)
CREATE TABLE coin_purchases (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id),
  telegram_charge_id  TEXT NOT NULL UNIQUE,
  stars_amount        INT NOT NULL,
  coins_amount        INT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coin_purchases_user ON coin_purchases(user_id);

-- Extend the balances view with a coins total
DROP VIEW user_balances;
CREATE VIEW user_balances AS
  SELECT u.id AS user_id,
         COALESCE(SUM(pl.delta),0)  AS points,
         COALESCE(SUM(tl.delta),0)  AS tickets,
         COALESCE(SUM(cl.delta),0)  AS coins
  FROM users u
  LEFT JOIN points_ledger pl ON pl.user_id = u.id
  LEFT JOIN ticket_ledger tl ON tl.user_id = u.id
  LEFT JOIN coins_ledger cl ON cl.user_id = u.id
  GROUP BY u.id;
