-- Stage 2: recurring Penpal access and billing-period character allowance.

CREATE TABLE subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    guest_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    status TEXT NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    chars_used INTEGER NOT NULL DEFAULT 0 CHECK (chars_used >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_id_present CHECK (length(stripe_subscription_id) > 0),
    CONSTRAINT subscriptions_status_known CHECK (status IN (
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
    ))
);

CREATE INDEX subscriptions_guest_user_id_idx ON subscriptions (guest_user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions (status);
CREATE INDEX subscriptions_period_end_idx ON subscriptions (current_period_end);
