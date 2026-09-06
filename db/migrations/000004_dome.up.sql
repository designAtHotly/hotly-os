-- Stage 2 Dome: newest-current prompt, notes/replies, implicit membership.
-- No moderation, approval, bans, or prompt lifecycle controls.

CREATE TABLE dome_prompts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL,
    created_by_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dome_prompts_slug_present CHECK (length(slug) > 0),
    CONSTRAINT dome_prompts_body_present CHECK (length(body) > 0)
);

CREATE INDEX dome_prompts_created_at_idx ON dome_prompts (created_at DESC, id DESC);

CREATE TABLE dome_notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prompt_id BIGINT NOT NULL REFERENCES dome_prompts (id) ON DELETE RESTRICT,
    author_user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    parent_id BIGINT REFERENCES dome_notes (id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    emoji TEXT NOT NULL DEFAULT '',
    shape TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dome_notes_body_present CHECK (length(body) > 0)
);

CREATE INDEX dome_notes_prompt_id_idx ON dome_notes (prompt_id, created_at, id);
CREATE INDEX dome_notes_author_prompt_idx ON dome_notes (author_user_id, prompt_id);

CREATE TABLE dome_memberships (
    user_id BIGINT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
