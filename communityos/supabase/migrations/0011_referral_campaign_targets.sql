ALTER TABLE referral_campaigns ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE referral_campaigns ADD COLUMN IF NOT EXISTS target_id INTEGER;
