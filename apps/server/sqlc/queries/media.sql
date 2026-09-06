-- name: InsertMediaObject :one
INSERT INTO media_objects (
    object_key,
    purpose,
    kind,
    content_type,
    byte_size,
    original_filename,
    uploaded_by_user_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetMediaObjectByID :one
SELECT *
FROM media_objects
WHERE id = $1;

-- name: GetMediaObjectByKey :one
SELECT *
FROM media_objects
WHERE object_key = $1;

-- name: ListMediaByMessageIDs :many
SELECT *
FROM media_objects
WHERE message_id = ANY($1::bigint[])
ORDER BY id ASC;

-- name: ListUnattachedAttachmentKeys :many
SELECT *
FROM media_objects
WHERE uploaded_by_user_id = $1
  AND purpose = 'attachment'
  AND message_id IS NULL
  AND created_at < $2
ORDER BY id ASC;

-- name: DeleteMediaObject :exec
DELETE FROM media_objects
WHERE id = $1
  AND message_id IS NULL;

-- name: AttachMediaToMessage :execrows
UPDATE media_objects
SET message_id = $2
WHERE object_key = $1
  AND uploaded_by_user_id = $3
  AND purpose = 'attachment'
  AND message_id IS NULL;

-- name: CountAttachmentsForMessage :one
SELECT count(*)::int AS n
FROM media_objects
WHERE message_id = $1;

-- name: InsertContentUnlock :execrows
INSERT INTO content_unlocks (message_id, guest_user_id, checkout_id)
VALUES ($1, $2, $3)
ON CONFLICT (message_id, guest_user_id) DO NOTHING;

-- name: GetContentUnlock :one
SELECT *
FROM content_unlocks
WHERE message_id = $1
  AND guest_user_id = $2;

-- name: ListUnlocksForGuest :many
SELECT message_id
FROM content_unlocks
WHERE guest_user_id = $1;

-- name: GetMessageByID :one
SELECT *
FROM messages
WHERE id = $1;

-- name: SetCreatorAvatarKey :one
UPDATE creators
SET avatar_object_key = $1,
    updated_at = now()
WHERE singleton = TRUE
RETURNING *;
