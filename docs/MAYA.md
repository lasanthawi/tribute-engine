# Maya AI Travel Influencer System

## Character
**Maya Elara** - 25-year-old solo traveler, remote worker, slow travel enthusiast

## Content Strategy
- **Public Channel:** 1 photo + caption daily
- **Premium:** Photo packs (15-25 images) sold via Tribute
- **Aesthetic:** Natural, calm, travel-focused (not sexualized)

## Revenue Model
- Monthly Subscription: $12/month (2-3 packs)
- One-Time Packs: $7 each

## Automation
1. **Daily Posts** - Scheduled via `/api/maya/post-daily` (cron)
2. **Content Generation** - AI captions + image prompts
3. **Purchase Handling** - Tribute webhook → auto-delivery

## Database Tables
```sql
CREATE TABLE maya_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maya_content_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_date DATE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  location TEXT,
  theme TEXT,
  status TEXT DEFAULT 'scheduled',
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maya_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount NUMERIC,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE maya_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_user_id TEXT NOT NULL,
  product_type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Setup
1. Add env variables: `MAYA_BOT_TOKEN`, `MAYA_CHANNEL_ID`, `MAYA_TRIBUTE_URL`
2. Run SQL to create tables
3. Set Telegram webhook: `https://tribute-engine.vercel.app/api/maya/bot`
4. Set Tribute webhook: `https://tribute-engine.vercel.app/api/maya/tribute-webhook`
5. Set up daily cron job for `/api/maya/post-daily`

## Content Guidelines
- Character is fictional and adult (25 years old)
- No sexualized content
- No fake personal interaction
- Clean travel aesthetic
- Consistent visual identity
