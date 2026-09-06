-- name: CreateRecoveryToken :one
INSERT INTO chat_recovery_tokens (conversation_id, guest_user_id, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetValidRecoveryToken :one
SELECT *
FROM chat_recovery_tokens
WHERE token_hash = $1
  AND consumed_at IS NULL
  AND expires_at > now();

-- name: ConsumeRecoveryToken :execrows
UPDATE chat_recovery_tokens
SET consumed_at = now()
WHERE id = $1
  AND consumed_at IS NULL;
