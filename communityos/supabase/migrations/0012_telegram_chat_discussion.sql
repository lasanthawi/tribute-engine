ALTER TABLE telegram_chats ADD COLUMN IF NOT EXISTS discussion_chat_id BIGINT;
ALTER TABLE telegram_chats ADD COLUMN IF NOT EXISTS discussion_bot_status TEXT;
