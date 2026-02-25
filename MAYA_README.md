# Maya's Travel Notes - AI Travel Influencer System

## Overview

Maya Elara is an AI-generated travel influencer running on Telegram. The system provides:
- **Public Channel**: Daily travel photos with reflective captions
- **Premium Packs**: Curated photo collections sold via Tribute
- **Full Automation**: Content generation, posting, and sales delivery

## Architecture

### Character Identity
- **Name**: Maya Elara
- **Age**: 25
- **Style**: Calm, observant, aesthetic travel content
- **Tone**: Introspective, curious, never sexualized

### Content Strategy
- **Public**: 1 photo/day with 40-70 word caption
- **Premium**: Themed photo packs (10-25 images)
- **Pricing**: $5-15 per pack or monthly subscription

## API Endpoints

### `POST /api/maya/daily-post`
Generates and posts daily content to the public channel.

**Authentication**: Bearer token (CRON_SECRET)

**Flow**:
1. Select random location + setting
2. Generate image with DALL-E 3
3. Generate caption with GPT-4
4. Post to Telegram channel
5. Store in database

**Cron Schedule**: Daily at 9 AM UTC
```
curl -X POST https://tribute-engine.vercel.app/api/maya/daily-post \
  -H "Authorization: Bearer maya-cron-secret-2024-secure"
```

### `POST /api/maya/generate-pack`
Creates a premium photo pack for sale.

**Authentication**: Bearer token (ADMIN_SECRET)

**Request**:
```json
{
  "theme": "Sunrise Mornings",
  "count": 15
}
```

**Flow**:
1. Generate themed prompts
2. Create 15 images with consistent character
3. Store in database
4. Mark pack as "ready" for sale

### `POST /api/maya/webhook`
Handles Tribute payment webhooks for premium sales.

**Flow**:
1. Verify Tribute signature
2. Create purchase record
3. Fetch latest photo pack
4. Send delivery message
5. Send photos to buyer
6. Notify ops bot

## Database Schema

### `maya_posts`
- Daily content posted to public channel
- Tracks posting status

### `maya_photo_packs`
- Premium themed collections
- Status: draft → ready → sold

### `maya_photos`
- Individual photos within packs
- Ordered for delivery

### `maya_purchases`
- Purchase records from Tribute
- Links users to delivered packs

## Setup Instructions

### 1. Environment Variables (Already Set)
```env
MAYA_BOT_TOKEN=8671170153:AAFhu0mdTwiBvyBROUXiB1uLeQ-DpNhpDr4
MAYA_CHANNEL=@pollianasela
CRON_SECRET=maya-cron-secret-2024-secure
ADMIN_SECRET=maya-admin-secret-2024
```

### 2. Register Telegram Webhook (Maya Bot)
Run in browser:
```
https://api.telegram.org/bot8671170153:AAFhu0mdTwiBvyBROUXiB1uLeQ-DpNhpDr4/setWebhook?url=https://tribute-engine.vercel.app/api/maya/webhook
```

### 3. Create Tribute Products

In Telegram @tribute:

**Product 1**: Monthly Subscription
- Name: "Maya's Private Album - Monthly"
- Price: $12/month
- Description: "2-3 exclusive photo packs each month from Maya's travels"

**Product 2**: Single Pack
- Name: "Premium Photo Pack"
- Price: $8
- Description: "15 high-quality travel photos from Maya's collection"

### 4. Set Tribute Webhook
In Tribute Dashboard → Webhooks:
```
URL: https://tribute-engine.vercel.app/api/maya/webhook
```

### 5. Setup Daily Cron Job

Using Vercel Cron (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/maya/daily-post",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Or use external cron service (cron-job.org):
- URL: `https://tribute-engine.vercel.app/api/maya/daily-post`
- Header: `Authorization: Bearer maya-cron-secret-2024-secure`
- Schedule: Daily at 9:00 AM UTC

### 6. Generate First Photo Pack

```bash
curl -X POST https://tribute-engine.vercel.app/api/maya/generate-pack \
  -H "Authorization: Bearer maya-admin-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"theme": "Morning Light", "count": 15}'
```

## Usage

### Daily Workflow (Automated)
1. Cron triggers daily-post endpoint
2. System generates image + caption
3. Posts to @pollianasela
4. Audience grows organically

### Premium Sales Workflow
1. User sees pinned message in channel
2. Clicks Tribute checkout link
3. Completes payment
4. Tribute webhook fires
5. System delivers photo pack via bot DM
6. User receives 15 photos instantly

### Content Generation (Manual)
Generate new premium packs weekly:
```bash
# Themed pack ideas
curl -X POST https://tribute-engine.vercel.app/api/maya/generate-pack \
  -H "Authorization: Bearer maya-admin-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"theme": "Sunset Views", "count": 15}'

curl -X POST https://tribute-engine.vercel.app/api/maya/generate-pack \
  -H "Authorization: Bearer maya-admin-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"theme": "Cozy Cafes", "count": 15}'

curl -X POST https://tribute-engine.vercel.app/api/maya/generate-pack \
  -H "Authorization: Bearer maya-admin-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"theme": "Beach Days", "count": 15}'
```

## Scaling Strategy

### Phase 1: Launch (Week 1-4)
- Daily posts for consistency
- 1 premium pack available
- Simple pinned message
- $8 one-time price

### Phase 2: Growth (Month 2-3)
- Add subscription option
- 3-4 premium packs available
- Themed collections
- $12/month recurring

### Phase 3: Scale (Month 4+)
- Multiple characters
- Different travel styles
- Seasonal collections
- Cross-promotions

## Content Guidelines

### ✅ Safe Content
- Natural travel scenes
- Aesthetic photography
- Casual travel outfits
- Reflective captions
- Calm, observant tone

### ❌ Prohibited Content
- No sexualized poses
- No suggestive framing
- No roleplay/DMs
- No fake interactions
- No manipulation language

## Monitoring

Check system health:
```bash
# Health check
curl https://tribute-engine.vercel.app/api/health

# Recent posts
curl https://tribute-engine.vercel.app/api/maya/stats
```

## Cost Estimate

**Monthly Operational Costs**:
- Vercel Hobby: Free
- Supabase Free Tier: Free
- OpenAI API (30 daily images + captions): ~$50/month
- Upstash Redis Free Tier: Free
- **Total**: ~$50/month

**Revenue Potential** (Conservative):
- 100 channel subscribers after 3 months
- 5% conversion to premium
- 5 sales × $8 = $40/month
- **Break-even**: Month 3-4
- **Profit**: Month 5+

## Support

- Channel: https://t.me/pollianasela
- Bot: @pollianasela_bot
- System: tribute-engine.vercel.app
