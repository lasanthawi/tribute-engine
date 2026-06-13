# VOTE LEAGUE Mini-Games Roadmap

## Current State

The app now has two lightweight games:

- Coin Catcher: 30-second reflex game, up to 3 plays per UTC day, points-only rewards.
- Daily Spin: one server-picked weighted spin per UTC day, small points/ticket/coin rewards.

The implementation is aligned with the existing ledger economy: rewards are credited server-side through append-only ledgers, and the client only submits the tap score or requests a spin result.

Validation on 2026-06-13:

```text
npx tsc --noEmit
yarn lint
yarn build
```

All passed locally after installing dependencies with `NODE_OPTIONS=--use-system-ca`.

## Market Signals

Current Telegram mini-game patterns still favor short sessions, instant play, daily rewards, referrals, leaderboards, team competition, and light progression. Recent market writeups around Telegram games and tap-to-earn apps point to the same direction: plain tapping is still accessible, but stronger retention comes from layered missions, social loops, leaderboards, squads, and richer mini-games beyond repeated tapping.

Useful references:

- [CoinSwitch: Telegram tap-to-earn games in 2026](https://coinswitch.co/switch/crypto/telegram-tap-to-earn-crypto-games/)
- [Monetag: gamified Telegram mini-apps](https://monetag.com/blog/gamified-telegram-mini-apps/)
- [PropellerAds: Telegram mini apps in 2026](https://propellerads.com/blog/adv-best-telegram-mini-apps/)
- [Telegram Mini Apps full-screen update coverage](https://www.theverge.com/2024/11/18/24299536/telegram-mini-apps-update-2-super-app)

## Recommended Game Types

### 1. Market Duel

Two players stake internal points, then make a BTC/ETH/TON UP/DOWN call for the same short window. The winner takes the points pot, with draws refunded.

Why it fits:

- Directly reinforces VOTE LEAGUE's core prediction identity.
- Easier to validate server-side than reflex/tap performance.
- Creates a natural invite loop: "I challenge you on BTC."
- Works async: player A creates a duel, player B accepts before lock.

Recommended first 2-player build.

### 2. Beat My Score

Player A posts a challenge score from Coin Catcher. Player B joins via invite and plays the same daily challenge. Highest score wins an internal points stake.

Why it fits:

- Viral social mechanic.
- Reuses the existing Tap Game.
- Good for friend invites and leaderboard screenshots.

Risk:

- Needs stronger anti-cheat before stakes matter, because the current tap score is client-submitted.

### 3. Squad Wars

Squads compete weekly using combined votes, correct calls, quests, and mini-game scores.

Why it fits:

- The schema already has squads.
- Encourages referrals without requiring gambling-like mechanics.
- Strong retention loop: users return to help the team.

### 4. Daily Market Streak

A quick daily card game: pick the strongest asset, weakest asset, or market direction. Rewards streaks and leaderboard rank.

Why it fits:

- Low engineering cost.
- Builds habit without extra risk.
- Easy to theme around crypto news or market sentiment.

### 5. Lucky Box / Mystery Card

A daily reveal with collectible cards, boosts, or cosmetics.

Why it fits:

- Highly shareable and simple.
- Can feed collection/progression loops.

Risk:

- Keep it free or clearly non-cash-out. Paid random rewards can create loot-box or gambling concerns.

## Can We Build 2-Player Games With A Bet?

Technically yes, but the first version should use internal non-cash points or coins only. Avoid real-money, crypto withdrawal, or cash-equivalent prizes until legal/compliance review is complete.

Recommended wording and product model:

- Use "stake" or "challenge pot" for internal points.
- Do not call it gambling or cash betting.
- No cash-out, token redemption, or external marketplace value.
- Use server escrow and deterministic settlement.
- Prefer skill/prediction outcomes over random chance.

Legal/compliance note: U.S. skill-game and gambling rules vary by state, and the distinction between skill, chance, consideration, and prize matters. Keep the MVP as social/virtual competition until reviewed.

## 2-Player MVP Architecture

### Tables

`duels`

- `id`
- `game_type`: `market_duel` initially
- `status`: `open`, `accepted`, `locked`, `settled`, `cancelled`, `expired`
- `creator_id`
- `opponent_id`
- `asset`
- `round_id` or explicit `lock_at` / `resolve_at`
- `stake_points`
- `winner_id`
- `created_at`, `accepted_at`, `settled_at`, `expires_at`

`duel_entries`

- `id`
- `duel_id`
- `user_id`
- `side`: `UP` or `DOWN`
- `score`
- `created_at`

### Ledger Types

Add points ledger entry types:

- `duel_stake`
- `duel_win`
- `duel_refund`

### Flow

1. Creator opens a challenge and stakes points.
2. Server debits creator into escrow via append-only ledger.
3. Opponent accepts and stakes the same amount.
4. Both choices lock before the market window closes.
5. Server settles from authoritative round result.
6. Winner receives pot; draw/void/expiry refunds both users.

### Abuse Controls

- Min/max stake limits.
- One open duel per user per asset/window at launch.
- Expiry refund job.
- No self-challenges.
- Idempotency key for accepts and settlement.
- Server-side validation for all balance changes.

## Required Hardening Before Staked Tap Duels

Coin Catcher is good for free rewards today, but not yet strong enough for meaningful stakes.

Before using it for staked duels:

- Add a server-issued game session before play starts.
- Store session start time, expiry, seed, and nonce.
- Submit score against that session once.
- Reject submissions outside the time window.
- Add plausible score bounds based on duration and input rate.
- Consider server-generated coin spawn data if stakes become valuable.

## Build Order

1. Harden current mini-game schema and duplicate-spin protection.
2. Add Market Duel with internal point stakes.
3. Add challenge links and "Rematch" sharing.
4. Add duel history and leaderboard.
5. Add Squad Wars once duels are stable.
6. Only then consider paid tournaments, and only after compliance review.
