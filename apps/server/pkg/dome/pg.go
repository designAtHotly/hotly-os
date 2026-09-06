package dome

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"hotly-opensource/server/pkg/db"
)

type pgStore struct {
	q *db.Queries
}

func NewPG(q *db.Queries) Store {
	return &pgStore{q: q}
}

func (p *pgStore) InsertPrompt(ctx context.Context, slug, body string, createdBy int64) (*Prompt, error) {
	row, err := p.q.InsertDomePrompt(ctx, db.InsertDomePromptParams{
		Slug:            slug,
		Body:            body,
		CreatedByUserID: createdBy,
	})
	if err != nil {
		return nil, err
	}
	return mapDBPrompt(row, 0), nil
}

func (p *pgStore) GetPromptBySlug(ctx context.Context, slug string) (*Prompt, error) {
	row, err := p.q.GetDomePromptBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return mapDBPrompt(row, 0), nil
}

func (p *pgStore) GetPromptByID(ctx context.Context, id int64) (*Prompt, error) {
	row, err := p.q.GetDomePromptByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return mapDBPrompt(row, 0), nil
}

func (p *pgStore) CurrentPrompt(ctx context.Context) (*Prompt, error) {
	row, err := p.q.GetCurrentDomePrompt(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return mapDBPrompt(row, 0), nil
}

func (p *pgStore) ListPrompts(ctx context.Context) ([]Prompt, error) {
	rows, err := p.q.ListDomePrompts(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Prompt, 0, len(rows))
	for _, row := range rows {
		out = append(out, Prompt{
			ID:        row.ID,
			Slug:      row.Slug,
			Body:      row.Body,
			CreatedBy: row.CreatedByUserID,
			CreatedAt: ts(row.CreatedAt),
			NoteCount: row.NoteCount,
		})
	}
	return out, nil
}

func (p *pgStore) InsertNote(ctx context.Context, n Note) (*Note, error) {
	row, err := p.q.InsertDomeNote(ctx, db.InsertDomeNoteParams{
		PromptID:     n.PromptID,
		AuthorUserID: n.AuthorUserID,
		ParentID:     optionalInt8(n.ParentID),
		Body:         n.Body,
		IsAnonymous:  n.Anonymous,
		Emoji:        n.Emoji,
		Shape:        n.Shape,
		Color:        n.Color,
	})
	if err != nil {
		return nil, err
	}
	return mapDBNote(row), nil
}

func (p *pgStore) GetNoteByID(ctx context.Context, id int64) (*Note, error) {
	row, err := p.q.GetDomeNoteByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return mapDBNote(row), nil
}

func (p *pgStore) ListNotes(ctx context.Context, promptID int64) ([]Note, error) {
	rows, err := p.q.ListDomeNotesByPrompt(ctx, promptID)
	if err != nil {
		return nil, err
	}
	out := make([]Note, 0, len(rows))
	for _, row := range rows {
		out = append(out, *mapDBNote(row))
	}
	return out, nil
}

func (p *pgStore) ListNotesByAuthor(ctx context.Context, promptID, authorID int64) ([]Note, error) {
	rows, err := p.q.ListDomeNotesByAuthor(ctx, db.ListDomeNotesByAuthorParams{
		PromptID:     promptID,
		AuthorUserID: authorID,
	})
	if err != nil {
		return nil, err
	}
	out := make([]Note, 0, len(rows))
	for _, row := range rows {
		out = append(out, *mapDBNote(row))
	}
	return out, nil
}

func (p *pgStore) EnsureMember(ctx context.Context, userID int64) error {
	return p.q.UpsertDomeMembership(ctx, userID)
}

func (p *pgStore) ListMembers(ctx context.Context) ([]Member, error) {
	rows, err := p.q.ListDomeMembers(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Member, 0, len(rows))
	for _, row := range rows {
		out = append(out, Member{
			UserID:   row.UserID,
			Email:    row.Email,
			Name:     row.DisplayName,
			JoinedAt: ts(row.CreatedAt),
		})
	}
	return out, nil
}

func mapDBPrompt(row *db.DomePrompt, noteCount int64) *Prompt {
	if row == nil {
		return nil
	}
	return &Prompt{
		ID:        row.ID,
		Slug:      row.Slug,
		Body:      row.Body,
		CreatedBy: row.CreatedByUserID,
		CreatedAt: ts(row.CreatedAt),
		NoteCount: noteCount,
	}
}

func mapDBNote(row *db.DomeNote) *Note {
	n := &Note{
		ID:           row.ID,
		PromptID:     row.PromptID,
		AuthorUserID: row.AuthorUserID,
		Body:         row.Body,
		Anonymous:    row.IsAnonymous,
		Emoji:        row.Emoji,
		Shape:        row.Shape,
		Color:        row.Color,
		CreatedAt:    ts(row.CreatedAt),
	}
	if row.ParentID.Valid {
		id := row.ParentID.Int64
		n.ParentID = &id
	}
	return n
}

func ts(v pgtype.Timestamptz) time.Time {
	if !v.Valid {
		return time.Time{}
	}
	return v.Time.UTC()
}

func optionalInt8(n *int64) pgtype.Int8 {
	if n == nil || *n <= 0 {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *n, Valid: true}
}
