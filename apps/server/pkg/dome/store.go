package dome

import (
	"context"
	"errors"
	"time"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrForbidden     = errors.New("forbidden")
	ErrInvalidInput  = errors.New("invalid input")
	ErrPromptMissing = errors.New("prompt missing")
	ErrParentInvalid = errors.New("parent invalid")
	ErrTooLong       = errors.New("too long")
	ErrFirebaseOnly  = errors.New("firebase required")
)

const (
	maxPromptRunes = 280
	maxNoteRunes   = 500
	maxStyleRunes  = 32
)

type Prompt struct {
	ID        int64
	Slug      string
	Body      string
	CreatedBy int64
	CreatedAt time.Time
	NoteCount int64
}

type Note struct {
	ID           int64
	PromptID     int64
	AuthorUserID int64
	ParentID     *int64
	Body         string
	Anonymous    bool
	Emoji        string
	Shape        string
	Color        string
	CreatedAt    time.Time
}

type Member struct {
	UserID   int64
	Email    string
	Name     string
	JoinedAt time.Time
}

type Store interface {
	InsertPrompt(ctx context.Context, slug, body string, createdBy int64) (*Prompt, error)
	GetPromptBySlug(ctx context.Context, slug string) (*Prompt, error)
	GetPromptByID(ctx context.Context, id int64) (*Prompt, error)
	CurrentPrompt(ctx context.Context) (*Prompt, error)
	ListPrompts(ctx context.Context) ([]Prompt, error)
	InsertNote(ctx context.Context, n Note) (*Note, error)
	GetNoteByID(ctx context.Context, id int64) (*Note, error)
	ListNotes(ctx context.Context, promptID int64) ([]Note, error)
	ListNotesByAuthor(ctx context.Context, promptID, authorID int64) ([]Note, error)
	EnsureMember(ctx context.Context, userID int64) error
	ListMembers(ctx context.Context) ([]Member, error)
}
