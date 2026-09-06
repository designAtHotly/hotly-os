-- name: UpsertSubscription :one
INSERT INTO subscriptions (
    guest_user_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    current_period_start,
    current_period_end,
    chars_used
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (stripe_subscription_id) DO UPDATE
SET status = EXCLUDED.status,
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    chars_used = CASE
        WHEN subscriptions.current_period_start IS DISTINCT FROM EXCLUDED.current_period_start THEN 0
        ELSE subscriptions.chars_used
    END,
    updated_at = now()
RETURNING *;

-- name: GetSubscriptionByStripeID :one
SELECT *
FROM subscriptions
WHERE stripe_subscription_id = $1;

-- name: GetActiveSubscriptionByGuest :one
SELECT *
FROM subscriptions
WHERE guest_user_id = $1
  AND status IN ('active', 'trialing', 'past_due')
  AND current_period_end > now()
ORDER BY current_period_end DESC, id DESC
LIMIT 1;

-- name: AddSubscriptionChars :one
UPDATE subscriptions
SET chars_used = chars_used + sqlc.arg(delta),
    updated_at = now()
WHERE id = sqlc.arg(id)
  AND status IN ('active', 'trialing', 'past_due')
  AND current_period_end > now()
  AND chars_used + sqlc.arg(delta) <= sqlc.arg(allowance)
RETURNING *;
