# Tribute Engine - Monetization Backend

Complete monetization system with:
- **Tribute Payments**: Subscriptions + Digital Products
- **Telegram Bots**: Public bot + Ops bot + Tools bot
- **AI Agent**: OpenAI integration for content generation
- **Database**: Supabase for users, events, entitlements, deliveries
- **Queue System**: Upstash Redis for async tasks

## Setup

1. Install dependencies: `npm install`
2. Configure environment variables in `.env.local`
3. Set up Supabase database schema (see below)
4. Deploy to Vercel
5. Register webhook URLs

## Database Schema

Run these SQL queries in Supabase:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id TEXT NOT NULL,
  product_type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Endpoints

- `POST /api/tribute/webhook` - Tribute payment webhooks
- `POST /api/telegram/public` - Public bot messages
- `POST /api/telegram/tools` - Tools bot commands
- `GET /api/health` - Health check
