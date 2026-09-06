-- name: GetConversationByGuestUserID :one
SELECT *
FROM conversations
WHERE guest_user_id = $1;

-- name: GetConversationByID :one
SELECT *
FROM conversations
WHERE id = $1;

-- name: CreateConversation :one
INSERT INTO conversations (guest_user_id)
VALUES ($1)
RETURNING *;

-- name: TouchConversation :exec
UPDATE conversations
SET last_activity_at = now()
WHERE id = $1;

-- name: ListConversations :many
SELECT
    c.id,
    c.guest_user_id,
    c.last_activity_at,
    c.blocked_at,
    c.created_at,
    u.email AS guest_email,
    u.display_name AS guest_display_name,
    COALESCE((
        SELECT SUM(p.amount_cents)
        FROM payments p
        JOIN checkouts ch ON ch.id = p.checkout_id
        WHERE ch.guest_user_id = c.guest_user_id
          AND ch.status = 'completed'
    ), 0)::bigint AS total_paid_cents,
    EXISTS (
        SELECT 1
        FROM subscriptions s
        WHERE s.guest_user_id = c.guest_user_id
          AND s.status IN ('active', 'trialing', 'past_due')
          AND s.current_period_end > now()
    ) AS is_subscriber
FROM conversations c
JOIN users u ON u.id = c.guest_user_id
ORDER BY c.last_activity_at DESC;

-- name: ListMessagesByConversation :many
SELECT *
FROM messages
WHERE conversation_id = $1
ORDER BY created_at ASC, id ASC;

-- name: CreateMessage :one
INSERT INTO messages (conversation_id, author_user_id, body, character_count, checkout_id, unlock_price_cents)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetMessageByCheckoutID :one
SELECT *
FROM messages
WHERE checkout_id = $1;

-- name: CreateCheckout :one
INSERT INTO checkouts (
    kind,
    guest_email,
    initial_message,
    amount_cents,
    currency,
    character_limit,
    target_message_id,
    guest_user_id
)
VALUES ($1, $2, $3, $4, 'usd', $5, $6, $7)
RETURNING *;

-- name: SetCheckoutStripeSession :exec
UPDATE checkouts
SET stripe_checkout_session_id = $2
WHERE id = $1;

-- name: GetCheckoutByStripeSessionID :one
SELECT *
FROM checkouts
WHERE stripe_checkout_session_id = $1;

-- name: GetCheckoutByPublicID :one
SELECT *
FROM checkouts
WHERE public_id = $1;

-- name: CompleteCheckout :execrows
UPDATE checkouts
SET status = 'completed',
    guest_user_id = $2,
    completed_at = now()
WHERE id = $1
  AND status = 'pending';

-- name: SetCheckoutStatus :execrows
UPDATE checkouts
SET status = $2
WHERE id = $1
  AND status = 'pending';

-- name: InsertPayment :one
INSERT INTO payments (checkout_id, stripe_payment_intent_id, amount_cents, currency)
VALUES ($1, $2, $3, 'usd')
RETURNING *;

-- name: TryInsertStripeEvent :execrows
INSERT INTO stripe_events (stripe_event_id, event_type)
VALUES ($1, $2)
ON CONFLICT (stripe_event_id) DO NOTHING;

-- name: SetConversationBlocked :execrows
UPDATE conversations
SET blocked_at = now()
WHERE id = $1
  AND blocked_at IS NULL;

-- name: SetConversationUnblocked :execrows
UPDATE conversations
SET blocked_at = NULL
WHERE id = $1
  AND blocked_at IS NOT NULL;

-- name: SumCompletedPaymentsByGuest :one
SELECT COALESCE(SUM(p.amount_cents), 0)::bigint AS total_cents
FROM payments p
JOIN checkouts c ON c.id = p.checkout_id
WHERE c.guest_user_id = $1
  AND c.status = 'completed';
