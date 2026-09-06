package dome

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/auth"
)

type Handler struct {
	svc  *Service
	auth *auth.Service
}

func NewHandler(svc *Service, authSvc *auth.Service) *Handler {
	return &Handler{svc: svc, auth: authSvc}
}

func Mount(r chi.Router, h *Handler) {
	r.Group(func(g chi.Router) {
		g.Use(auth.OptionalUser(h.auth))
		g.Get("/dome", h.home)
		g.Get("/dome/prompts", h.listPrompts)
		g.Get("/dome/prompts/{slug}", h.promptPage)
		g.Get("/dome/prompts/{slug}/notes", h.promptNotes)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireUser(h.auth))
		g.Post("/dome/notes", h.createNote)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireCreator(h.auth))
		g.Post("/dome/prompts", h.createPrompt)
		g.Get("/dome/members", h.members)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeDomeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrPromptMissing):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
	case errors.Is(err, ErrUnauthorized), errors.Is(err, auth.ErrUnauthorized):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	case errors.Is(err, ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	case errors.Is(err, ErrFirebaseOnly):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "firebase_required"})
	case errors.Is(err, ErrInvalidInput), errors.Is(err, ErrParentInvalid):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_input"})
	case errors.Is(err, ErrTooLong):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too_long"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
	}
}

func (h *Handler) home(w http.ResponseWriter, req *http.Request) {
	current, prompts, notes, err := h.svc.Home(req.Context())
	if err != nil {
		writeDomeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"community":      h.svc.Community(req.Context()),
		"current_prompt": mapPrompt(current),
		"prompts":        mapPrompts(prompts),
		"notes":          h.mapNotes(req, notes),
		"total_count":    len(notes),
	})
}

func (h *Handler) listPrompts(w http.ResponseWriter, req *http.Request) {
	prompts, err := h.svc.ListPrompts(req.Context())
	if err != nil {
		writeDomeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, mapPrompts(prompts))
}

func (h *Handler) promptPage(w http.ResponseWriter, req *http.Request) {
	prompt, notes, err := h.svc.PromptPage(req.Context(), chi.URLParam(req, "slug"))
	if err != nil {
		writeDomeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"community":   h.svc.Community(req.Context()),
		"prompt":      mapPrompt(prompt),
		"notes":       h.mapNotes(req, notes),
		"total_count": len(notes),
	})
}

func (h *Handler) promptNotes(w http.ResponseWriter, req *http.Request) {
	slug := chi.URLParam(req, "slug")
	if req.URL.Query().Get("mine") == "1" {
		principal, ok := auth.PrincipalFrom(req.Context())
		if !ok {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		notes, err := h.svc.NotesByAuthor(req.Context(), slug, principal.User.ID)
		if err != nil {
			writeDomeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, h.mapNotes(req, notes))
		return
	}
	prompt, notes, err := h.svc.PromptPage(req.Context(), slug)
	if err != nil {
		writeDomeError(w, err)
		return
	}
	_ = prompt
	writeJSON(w, http.StatusOK, map[string]any{
		"total_count": len(notes),
		"notes":       h.mapNotes(req, notes),
	})
}

type createPromptBody struct {
	Content     string `json:"content"`
	FirstPrompt string `json:"first_prompt"`
}

func (h *Handler) createPrompt(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeDomeError(w, ErrUnauthorized)
		return
	}
	var body createPromptBody
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	content := body.Content
	if strings.TrimSpace(content) == "" {
		content = body.FirstPrompt
	}
	prompt, err := h.svc.CreatePrompt(req.Context(), content, principal.User.ID)
	if err != nil {
		writeDomeError(w, err)
		return
	}
	mapped := mapPrompt(prompt)
	writeJSON(w, http.StatusOK, map[string]any{
		"community": h.svc.Community(req.Context()),
		"prompt":    mapped,
	})
}

type createNoteBody struct {
	PromptUUID  string `json:"prompt_uuid"`
	ParentUUID  string `json:"parent_uuid"`
	Content     string `json:"content"`
	IsAnonymous bool   `json:"is_anonymous"`
	Emoji       string `json:"emoji"`
	Shape       string `json:"shape"`
	Color       string `json:"color"`
}

func (h *Handler) createNote(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeDomeError(w, ErrUnauthorized)
		return
	}
	var body createNoteBody
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	note, err := h.svc.CreateNote(req.Context(), principal, CreateNoteInput{
		PromptSlug: body.PromptUUID,
		ParentID:   parseNoteID(body.ParentUUID),
		Body:       body.Content,
		Anonymous:  body.IsAnonymous,
		Emoji:      body.Emoji,
		Shape:      body.Shape,
		Color:      body.Color,
	})
	if err != nil {
		writeDomeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, h.mapNote(req, *note))
}

func (h *Handler) members(w http.ResponseWriter, req *http.Request) {
	members, err := h.svc.Members(req.Context())
	if err != nil {
		writeDomeError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(members))
	for _, m := range members {
		out = append(out, map[string]any{
			"id":         m.UserID,
			"name":       m.Name,
			"email":      m.Email,
			"avatar_url": nil,
			"joined_at":  m.JoinedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func mapPrompt(p *Prompt) map[string]any {
	if p == nil {
		return nil
	}
	return map[string]any{
		"id":           p.ID,
		"uuid":         p.Slug,
		"community_id": 1,
		"content":      p.Body,
		"share_slug":   p.Slug,
		"emoji":        nil,
		"shape":        nil,
		"color":        nil,
		"created_at":   p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":   p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"note_count":   p.NoteCount,
	}
}

func mapPrompts(prompts []Prompt) []map[string]any {
	out := make([]map[string]any, 0, len(prompts))
	for i := range prompts {
		out = append(out, mapPrompt(&prompts[i]))
	}
	return out
}

func (h *Handler) mapNotes(req *http.Request, notes []Note) []map[string]any {
	out := make([]map[string]any, 0, len(notes))
	for _, n := range notes {
		out = append(out, h.mapNote(req, n))
	}
	return out
}

func (h *Handler) mapNote(req *http.Request, n Note) map[string]any {
	id := noteIDString(n.ID)
	var parent any
	var parentUUID any
	if n.ParentID != nil {
		parent = *n.ParentID
		parentUUID = noteIDString(*n.ParentID)
	}
	name := ""
	if !n.Anonymous {
		name = h.svc.AuthorName(req.Context(), n.AuthorUserID)
	}
	return map[string]any{
		"id":                n.ID,
		"uuid":              id,
		"share_slug":        id,
		"community_id":      1,
		"prompt_id":         n.PromptID,
		"author_id":         n.AuthorUserID,
		"parent_id":         parent,
		"parent_uuid":       parentUUID,
		"content":           n.Body,
		"emoji":             emptyNull(n.Emoji),
		"shape":             emptyNull(n.Shape),
		"color":             emptyNull(n.Color),
		"is_anonymous":      n.Anonymous,
		"created_at":        n.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"updated_at":        n.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		"author_name":       name,
		"author_avatar_url": nil,
	}
}

func emptyNull(s string) any {
	if s == "" {
		return nil
	}
	return s
}
