# CALLED IT 🎯

A free, daily prediction game inside Telegram. Players spend free daily
tickets calling **UP/DOWN** on BTC, ETH, and TON prices, earn points for
correct calls, build streaks, and climb seasonal leaderboards — all
auto-settled via price oracles, no manual adjudication.

This is the **Phase 1 MVP**: binary crypto rounds, points + ticket ledger,
streaks, confidence staking, 1-level referrals with downline override,
weekly/season leaderboards, and a Telegram Mini App.

## Stack

- **Mini App**: Next.js (Pages Router) + React, Telegram Web App SDK
- **Backend**: Next.js API routes
- **Database**: Supabase (Postgres) — append-only points/ticket ledgers
- **Oracles**: Pyth (primary) + Binance (secondary), reconciled with 0.5% tolerance
- **Telegram**: a minimal bot (`/start` only) that launches the Mini App
- **Deployment**: Vercel, with cron jobs driving the round lifecycle

## Demo mode (no backend required)

If `SUPABASE_URL` isn't set, every API route serves realistic mock data
(rounds, balances, calls history, leaderboard, referral stats) instead of
hitting Supabase. This lets you run `yarn dev` and preview/iterate on every
screen of the Mini App immediately, with no Supabase or Telegram setup.
Demo mode turns itself off automatically once `SUPABASE_URL` is configured.

## Setup

1. `yarn install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` — from BotFather
   - `MINI_APP_URL` — the deployed Mini App URL (set as the bot's web app)
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` — shared secret for cron endpoints
3. Run the migrations in `supabase/migrations/` against your Supabase project
   (creates the schema and seeds Season 0).
4. Register the Telegram webhook to point at `/api/telegram/webhook`.
5. Deploy to Vercel — `vercel.json` wires up the round lifecycle crons.

## Round lifecycle

```
SCHEDULED -> OPEN -> LOCKED -> SETTLING -> SETTLED
                                   |
                                   -> VOIDED (oracle disagreement / tie)
```

Driven by `/api/cron/round-scheduler`, `round-opener`, `round-locker`, and
`round-settler` — see `lib/rounds.ts` for the state machine and settlement
algorithm.

## Mini App screens

- **Home** — open rounds, tickets, streak, one-tap UP/DOWN
- **My Calls** — pending + settled history, share-the-win
- **Leaderboard** — weekly + season rankings
- **Invite** — referral link, activations, downline override earnings

## Schema-ready, Phase 2+

Squads, sponsored rounds, sports markets, and the $CALL token are out of
scope for Phase 1 but the `squads`/`squad_members` tables already exist.

## Endpoints

- `POST /api/telegram/webhook` — Telegram bot webhook (`/start` only)
- `GET /api/rounds/open` — open rounds + your prediction state
- `POST /api/predictions/create` — place a prediction
- `GET /api/me` — profile + balances + streak
- `GET /api/me/calls` — prediction history
- `GET /api/leaderboard?period=weekly|season`
- `GET /api/referral/info` — referral link + stats
- `GET /api/health` — health check
