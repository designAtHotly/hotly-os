package dome

import (
	"context"
	"sort"
	"sync"
	"time"
)

type Mem struct {
	mu      sync.Mutex
	prompts map[int64]*Prompt
	bySlug  map[string]int64
	notes   map[int64]*Note
	members map[int64]time.Time
	nextP   int64
	nextN   int64
}

func NewMem() *Mem {
	return &Mem{
		prompts: map[int64]*Prompt{},
		bySlug:  map[string]int64{},
		notes:   map[int64]*Note{},
		members: map[int64]time.Time{},
		nextP:   1,
		nextN:   1,
	}
}

func (m *Mem) InsertPrompt(_ context.Context, slug, body string, createdBy int64) (*Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.bySlug[slug]; exists {
		return nil, ErrInvalidInput
	}
	id := m.nextP
	m.nextP++
	p := &Prompt{
		ID:        id,
		Slug:      slug,
		Body:      body,
		CreatedBy: createdBy,
		CreatedAt: time.Now().UTC(),
	}
	m.prompts[id] = p
	m.bySlug[slug] = id
	cp := *p
	return &cp, nil
}

func (m *Mem) GetPromptBySlug(_ context.Context, slug string) (*Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.bySlug[slug]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *m.prompts[id]
	cp.NoteCount = m.countNotesLocked(id)
	return &cp, nil
}

func (m *Mem) GetPromptByID(_ context.Context, id int64) (*Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.prompts[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *p
	cp.NoteCount = m.countNotesLocked(id)
	return &cp, nil
}

func (m *Mem) CurrentPrompt(_ context.Context) (*Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var best *Prompt
	for _, p := range m.prompts {
		if best == nil || p.CreatedAt.After(best.CreatedAt) || (p.CreatedAt.Equal(best.CreatedAt) && p.ID > best.ID) {
			cp := *p
			best = &cp
		}
	}
	if best == nil {
		return nil, nil
	}
	best.NoteCount = m.countNotesLocked(best.ID)
	return best, nil
}

func (m *Mem) ListPrompts(_ context.Context) ([]Prompt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Prompt, 0, len(m.prompts))
	for _, p := range m.prompts {
		cp := *p
		cp.NoteCount = m.countNotesLocked(p.ID)
		out = append(out, cp)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].ID > out[j].ID
	})
	return out, nil
}

func (m *Mem) InsertNote(_ context.Context, n Note) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextN
	m.nextN++
	n.ID = id
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	cp := n
	m.notes[id] = &cp
	out := n
	return &out, nil
}

func (m *Mem) GetNoteByID(_ context.Context, id int64) (*Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n, ok := m.notes[id]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *n
	return &cp, nil
}

func (m *Mem) ListNotes(_ context.Context, promptID int64) ([]Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Note, 0)
	for _, n := range m.notes {
		if n.PromptID == promptID {
			out = append(out, *n)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (m *Mem) ListNotesByAuthor(_ context.Context, promptID, authorID int64) ([]Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Note, 0)
	for _, n := range m.notes {
		if n.PromptID == promptID && n.AuthorUserID == authorID {
			out = append(out, *n)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (m *Mem) EnsureMember(_ context.Context, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.members[userID]; !ok {
		m.members[userID] = time.Now().UTC()
	}
	return nil
}

func (m *Mem) ListMembers(_ context.Context) ([]Member, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Member, 0, len(m.members))
	for id, joined := range m.members {
		out = append(out, Member{UserID: id, JoinedAt: joined})
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].JoinedAt.Equal(out[j].JoinedAt) {
			return out[i].JoinedAt.Before(out[j].JoinedAt)
		}
		return out[i].UserID < out[j].UserID
	})
	return out, nil
}

func (m *Mem) countNotesLocked(promptID int64) int64 {
	var n int64
	for _, note := range m.notes {
		if note.PromptID == promptID {
			n++
		}
	}
	return n
}
