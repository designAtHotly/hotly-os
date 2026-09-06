-- Stage 1 foundation: identity, singleton creator, payments, Penpal.
-- Fresh history. No legacy Hotly compatibility. USD amounts are integer cents.

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    firebase_uid TEXT,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_present CHECK (length(email) > 0)
);

CREATE UNIQUE INDEX users_firebase_uid_uidx
    ON users (firebase_uid)
    WHERE firebase_uid IS NOT NULL;

CREATE UNIQUE INDEX users_email_lower_uidx
    ON users (LOWER(email));

CREATE TABLE sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sessions_token_hash_present CHECK (length(token_hash) > 0)
);

CREATE UNIQUE INDEX sessions_token_hash_uidx ON sessions (token_hash);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE creators (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    singleton BOOLEAN NOT NULL DEFAULT TRUE CHECK (singleton) UNIQUE,
    user_id BIGINT UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    avatar_object_key TEXT,
    support_item TEXT NOT NULL DEFAULT 'coffee'
        CHECK (support_item IN ('coffee', 'cocktail', 'lemonade')),
    one_time_price_cents BIGINT NOT NULL CHECK (one_time_price_cents > 0),
    one_time_character_limit INTEGER NOT NULL CHECK (one_time_character_limit > 0),
    weekly_price_cents BIGINT NOT NULL CHECK (weekly_price_cents > 0),
    weekly_allowance_chars INTEGER NOT NULL DEFAULT 2000
        CHECK (weekly_allowance_chars = 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT creators_email_present CHECK (length(email) > 0)
);

CREATE UNIQUE INDEX creators_email_lower_uidx ON creators (LOWER(email));

CREATE TABLE checkouts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT uuidv7() UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('one_time_message', 'weekly_subscription', 'paid_content')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'expired', 'canceled', 'failed')),
    guest_email TEXT NOT NULL,
    guest_user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT,
    initial_message TEXT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
    character_limit INTEGER CHECK (character_limit IS NULL OR character_limit > 0),
    stripe_checkout_session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT checkouts_guest_email_present CHECK (length(guest_email) > 0)
);

CREATE INDEX checkouts_guest_user_id_idx ON checkouts (guest_user_id);
CREATE INDEX checkouts_status_idx ON checkouts (status);

CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checkout_id BIGINT NOT NULL REFERENCES checkouts (id) ON DELETE RESTRICT,
    stripe_payment_intent_id TEXT UNIQUE,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_checkout_id_idx ON payments (checkout_id);

CREATE TABLE stripe_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT stripe_events_id_present CHECK (length(stripe_event_id) > 0)
);

CREATE TABLE conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guest_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    blocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_guest_unique UNIQUE (guest_user_id)
);

CREATE INDEX conversations_last_activity_idx ON conversations (last_activity_at DESC);

CREATE TABLE messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE RESTRICT,
    author_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    character_count INTEGER NOT NULL CHECK (character_count >= 0),
    checkout_id BIGINT REFERENCES checkouts (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_id_idx ON messages (conversation_id);
CREATE INDEX messages_created_at_idx ON messages (conversation_id, created_at);
CREATE INDEX messages_author_user_id_idx ON messages (author_user_id);
CREATE INDEX messages_checkout_id_idx ON messages (checkout_id);

CREATE TABLE chat_recovery_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    guest_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chat_recovery_tokens_hash_present CHECK (length(token_hash) > 0)
);

CREATE UNIQUE INDEX chat_recovery_tokens_hash_uidx ON chat_recovery_tokens (token_hash);
CREATE INDEX chat_recovery_tokens_conversation_id_idx ON chat_recovery_tokens (conversation_id);
CREATE INDEX chat_recovery_tokens_guest_user_id_idx ON chat_recovery_tokens (guest_user_id);
