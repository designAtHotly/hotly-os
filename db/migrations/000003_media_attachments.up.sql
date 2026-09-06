-- Creator-only image/video attachments, avatars, and paid-content unlocks.

ALTER TABLE messages
    ADD COLUMN unlock_price_cents BIGINT
        CHECK (unlock_price_cents IS NULL OR unlock_price_cents > 0);

ALTER TABLE checkouts
    ADD COLUMN target_message_id BIGINT REFERENCES messages (id) ON DELETE RESTRICT;

CREATE INDEX checkouts_target_message_id_idx ON checkouts (target_message_id);

CREATE TABLE media_objects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    object_key TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL CHECK (purpose IN ('attachment', 'avatar')),
    kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
    content_type TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    original_filename TEXT NOT NULL DEFAULT '',
    uploaded_by_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    message_id BIGINT REFERENCES messages (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT media_objects_key_present CHECK (length(object_key) > 0),
    CONSTRAINT media_objects_type_present CHECK (length(content_type) > 0),
    CONSTRAINT media_objects_avatar_is_image CHECK (purpose <> 'avatar' OR kind = 'image')
);

CREATE INDEX media_objects_message_id_idx ON media_objects (message_id);
CREATE INDEX media_objects_uploaded_by_idx ON media_objects (uploaded_by_user_id);
CREATE INDEX media_objects_unattached_idx ON media_objects (uploaded_by_user_id, created_at)
    WHERE message_id IS NULL AND purpose = 'attachment';

CREATE TABLE content_unlocks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages (id) ON DELETE RESTRICT,
    guest_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    checkout_id BIGINT NOT NULL REFERENCES checkouts (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT content_unlocks_once UNIQUE (message_id, guest_user_id)
);

CREATE INDEX content_unlocks_guest_user_id_idx ON content_unlocks (guest_user_id);
CREATE INDEX content_unlocks_checkout_id_idx ON content_unlocks (checkout_id);
