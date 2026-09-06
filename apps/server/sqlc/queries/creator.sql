-- name: GetCreator :one
SELECT *
FROM creators
WHERE singleton = TRUE;

-- name: CreateCreator :one
INSERT INTO creators (
    email,
    display_name,
    description,
    support_item,
    one_time_price_cents,
    one_time_character_limit,
    weekly_price_cents,
    weekly_allowance_chars
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpsertCreatorUser :one
INSERT INTO creators (
    email,
    display_name,
    description,
    support_item,
    one_time_price_cents,
    one_time_character_limit,
    weekly_price_cents,
    weekly_allowance_chars,
    user_id
)
VALUES ($1, $2, '', $3, $4, $5, $6, 2000, $7)
ON CONFLICT (singleton) DO UPDATE
SET user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    updated_at = now()
RETURNING *;

-- name: UpdateCreatorSettings :one
UPDATE creators
SET display_name = $1,
    description = $2,
    support_item = $3,
    one_time_price_cents = $4,
    one_time_character_limit = $5,
    weekly_price_cents = $6,
    updated_at = now()
WHERE singleton = TRUE
RETURNING *;
