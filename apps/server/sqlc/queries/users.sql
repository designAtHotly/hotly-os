-- name: GetUserByID :one
SELECT *
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE LOWER(email) = LOWER($1);

-- name: GetUserByFirebaseUID :one
SELECT *
FROM users
WHERE firebase_uid = $1;

-- name: CreateUser :one
INSERT INTO users (firebase_uid, email, display_name)
VALUES ($1, $2, $3)
RETURNING *;

-- name: CreateGuestUser :one
INSERT INTO users (email, display_name)
VALUES ($1, $2)
RETURNING *;

-- name: UpdateUserFirebase :exec
UPDATE users
SET firebase_uid = sqlc.arg(firebase_uid),
    display_name = CASE WHEN sqlc.arg(display_name) = '' THEN display_name ELSE sqlc.arg(display_name) END,
    updated_at = now()
WHERE id = sqlc.arg(id);
