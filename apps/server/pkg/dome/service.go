package dome

import (
	"context"
	"crypto/rand"
	"strconv"
	"strings"
	"unicode/utf8"

	"hotly-opensource/server/pkg/auth"
)

type Service struct {
	store Store
	auth  *auth.Service
}

func NewService(store Store, authSvc *auth.Service) *Service {
	return &Service{store: store, auth: authSvc}
}

type CreateNoteInput struct {
	PromptSlug string
	ParentID   int64
	Body       string
	Anonymous  bool
	Emoji      string
	Shape      string
	Color      string
}

func (s *Service) Home(ctx context.Context) (*Prompt, []Prompt, []Note, error) {
	current, err := s.store.CurrentPrompt(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	prompts, err := s.store.ListPrompts(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	var notes []Note
	if current != nil {
		notes, err = s.store.ListNotes(ctx, current.ID)
		if err != nil {
			return nil, nil, nil, err
		}
	}
	return current, prompts, notes, nil
}

func (s *Service) PromptPage(ctx context.Context, slug string) (*Prompt, []Note, error) {
	prompt, err := s.store.GetPromptBySlug(ctx, slug)
	if err != nil {
		return nil, nil, err
	}
	notes, err := s.store.ListNotes(ctx, prompt.ID)
	if err != nil {
		return nil, nil, err
	}
	return prompt, notes, nil
}

func (s *Service) ListPrompts(ctx context.Context) ([]Prompt, error) {
	return s.store.ListPrompts(ctx)
}

func (s *Service) NotesByAuthor(ctx context.Context, slug string, authorID int64) ([]Note, error) {
	prompt, err := s.store.GetPromptBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return s.store.ListNotesByAuthor(ctx, prompt.ID, authorID)
}

func (s *Service) CreatePrompt(ctx context.Context, body string, createdBy int64) (*Prompt, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, ErrInvalidInput
	}
	if utf8.RuneCountInString(body) > maxPromptRunes {
		return nil, ErrTooLong
	}
	var last error
	for i := 0; i < 5; i++ {
		slug, err := newSlug()
		if err != nil {
			return nil, err
		}
		prompt, err := s.store.InsertPrompt(ctx, slug, body, createdBy)
		if err == nil {
			return prompt, nil
		}
		last = err
	}
	return nil, last
}

func (s *Service) CreateNote(ctx context.Context, principal auth.Principal, in CreateNoteInput) (*Note, error) {
	if principal.User.FirebaseUID == "" {
		return nil, ErrFirebaseOnly
	}
	body := strings.TrimSpace(in.Body)
	if body == "" {
		return nil, ErrInvalidInput
	}
	if utf8.RuneCountInString(body) > maxNoteRunes {
		return nil, ErrTooLong
	}
	prompt, err := s.resolvePrompt(ctx, in.PromptSlug)
	if err != nil {
		return nil, err
	}
	if prompt == nil {
		return nil, ErrPromptMissing
	}
	var parentID *int64
	if in.ParentID > 0 {
		parent, err := s.store.GetNoteByID(ctx, in.ParentID)
		if err != nil {
			return nil, ErrParentInvalid
		}
		if parent.PromptID != prompt.ID {
			return nil, ErrParentInvalid
		}
		id := parent.ID
		parentID = &id
	}
	note, err := s.store.InsertNote(ctx, Note{
		PromptID:     prompt.ID,
		AuthorUserID: principal.User.ID,
		ParentID:     parentID,
		Body:         body,
		Anonymous:    in.Anonymous,
		Emoji:        clipStyle(in.Emoji),
		Shape:        clipStyle(in.Shape),
		Color:        clipStyle(in.Color),
	})
	if err != nil {
		return nil, err
	}
	if err := s.store.EnsureMember(ctx, principal.User.ID); err != nil {
		return nil, err
	}
	return note, nil
}

func (s *Service) Members(ctx context.Context) ([]Member, error) {
	members, err := s.store.ListMembers(ctx)
	if err != nil {
		return nil, err
	}
	for i := range members {
		if members[i].Email != "" {
			continue
		}
		u, err := s.auth.UserByID(ctx, members[i].UserID)
		if err != nil || u == nil {
			continue
		}
		members[i].Email = u.Email
		members[i].Name = u.DisplayName
	}
	return members, nil
}

func (s *Service) Community(ctx context.Context) map[string]any {
	prompts, err := s.store.ListPrompts(ctx)
	if err != nil || len(prompts) == 0 {
		return nil
	}
	created := prompts[len(prompts)-1].CreatedAt
	return map[string]any{
		"id":          1,
		"uuid":        "dome",
		"creator_id":  prompts[len(prompts)-1].CreatedBy,
		"title":       "Dome",
		"description": nil,
		"created_at":  created.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":  prompts[0].CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func (s *Service) resolvePrompt(ctx context.Context, slug string) (*Prompt, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" || slug == "dome" {
		return s.store.CurrentPrompt(ctx)
	}
	return s.store.GetPromptBySlug(ctx, slug)
}

func (s *Service) AuthorName(ctx context.Context, userID int64) string {
	u, err := s.auth.UserByID(ctx, userID)
	if err != nil || u == nil {
		return ""
	}
	return u.DisplayName
}

func clipStyle(v string) string {
	v = strings.TrimSpace(v)
	if utf8.RuneCountInString(v) > maxStyleRunes {
		return string([]rune(v)[:maxStyleRunes])
	}
	return v
}

func newSlug() (string, error) {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

func noteIDString(id int64) string {
	return strconv.FormatInt(id, 10)
}

func parseNoteID(s string) int64 {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "note-")
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}
