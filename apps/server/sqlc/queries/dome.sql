-- name: InsertDomePrompt :one
INSERT INTO dome_prompts (slug, body, created_by_user_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetDomePromptBySlug :one
SELECT *
FROM dome_prompts
WHERE slug = $1;

-- name: GetDomePromptByID :one
SELECT *
FROM dome_prompts
WHERE id = $1;

-- name: GetCurrentDomePrompt :one
SELECT *
FROM dome_prompts
ORDER BY created_at DESC, id DESC
LIMIT 1;

-- name: ListDomePrompts :many
SELECT
    p.*,
    (
        SELECT count(*)::bigint
        FROM dome_notes n
        WHERE n.prompt_id = p.id
    ) AS note_count
FROM dome_prompts p
ORDER BY p.created_at DESC, p.id DESC;

-- name: InsertDomeNote :one
INSERT INTO dome_notes (prompt_id, author_user_id, parent_id, body, is_anonymous, emoji, shape, color)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetDomeNoteByID :one
SELECT *
FROM dome_notes
WHERE id = $1;

-- name: ListDomeNotesByPrompt :many
SELECT *
FROM dome_notes
WHERE prompt_id = $1
ORDER BY created_at ASC, id ASC;

-- name: ListDomeNotesByAuthor :many
SELECT *
FROM dome_notes
WHERE prompt_id = $1 AND author_user_id = $2
ORDER BY created_at ASC, id ASC;

-- name: UpsertDomeMembership :exec
INSERT INTO dome_memberships (user_id)
VALUES ($1)
ON CONFLICT (user_id) DO NOTHING;

-- name: ListDomeMembers :many
SELECT
    m.user_id,
    m.created_at,
    u.email,
    u.display_name
FROM dome_memberships m
JOIN users u ON u.id = m.user_id
ORDER BY m.created_at ASC, m.user_id ASC;
