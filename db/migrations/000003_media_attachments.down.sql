DROP TABLE IF EXISTS content_unlocks;
DROP TABLE IF EXISTS media_objects;
DROP INDEX IF EXISTS checkouts_target_message_id_idx;
ALTER TABLE checkouts DROP COLUMN IF EXISTS target_message_id;
ALTER TABLE messages DROP COLUMN IF EXISTS unlock_price_cents;
