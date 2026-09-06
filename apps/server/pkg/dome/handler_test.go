package dome

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/config"
)

func testAPI() (http.Handler, auth.Store, *auth.Service, *Mem) {
	cfg := &config.Config{
		CreatorEmail:       "creator@example.com",
		CreatorDisplayName: "Ada",
	}
	users := auth.NewMemoryStore()
	authSvc := auth.NewService(users, nil, auth.CreatorSettings{
		Email:                 cfg.CreatorEmail,
		DisplayName:           cfg.CreatorDisplayName,
		SupportItem:           "coffee",
		OneTimePriceCents:     500,
		OneTimeCharacterLimit: 250,
		WeeklyPriceCents:      1500,
	}, false)
	mem := NewMem()
	h := NewHandler(NewService(mem, authSvc), authSvc)
	r := chi.NewRouter()
	Mount(r, h)
	return r, users, authSvc, mem
}

func doJSON(handler http.Handler, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var rdr io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func sessionFor(t *testing.T, store auth.Store, authSvc *auth.Service, uid, email, name string) (*http.Cookie, *auth.User) {
	t.Helper()
	u, err := store.CreateUser(context.Background(), uid, email, name)
	if err != nil {
		t.Fatal(err)
	}
	if email == "creator@example.com" {
		if err := store.UpsertCreatorUser(context.Background(), email, name, "coffee", 500, 250, 1500, u.ID); err != nil {
			t.Fatal(err)
		}
	}
	token, expires, err := authSvc.IssueSession(context.Background(), u.ID)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Cookie{Name: auth.SessionCookieName, Value: token, Expires: expires}, u
}

func guestSession(t *testing.T, store auth.Store, authSvc *auth.Service) *http.Cookie {
	t.Helper()
	u, err := store.CreateUser(context.Background(), "", "guest@example.com", "Guest")
	if err != nil {
		t.Fatal(err)
	}
	token, expires, err := authSvc.IssueSession(context.Background(), u.ID)
	if err != nil {
		t.Fatal(err)
	}
	_ = u
	return &http.Cookie{Name: auth.SessionCookieName, Value: token, Expires: expires}
}

func TestVisitorCanViewNewestPromptAndNotes(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creator, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	created := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "What made you smile?"}, creator)
	if created.Code != http.StatusOK {
		t.Fatalf("create prompt %d %s", created.Code, created.Body.String())
	}
	home := doJSON(handler, http.MethodGet, "/dome", nil)
	if home.Code != http.StatusOK {
		t.Fatalf("home %d %s", home.Code, home.Body.String())
	}
	if !strings.Contains(home.Body.String(), `"content":"What made you smile?"`) {
		t.Fatalf("missing current prompt: %s", home.Body.String())
	}
	if !strings.Contains(home.Body.String(), `"uuid":"dome"`) {
		t.Fatalf("missing community: %s", home.Body.String())
	}
}

func TestHistoricalPromptIsShareableBySlug(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creator, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	first := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "First prompt"}, creator)
	second := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Newest prompt"}, creator)
	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("prompts %d %d", first.Code, second.Code)
	}
	var created struct {
		Prompt struct {
			ShareSlug string `json:"share_slug"`
			Content   string `json:"content"`
		} `json:"prompt"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	page := doJSON(handler, http.MethodGet, "/dome/prompts/"+created.Prompt.ShareSlug, nil)
	if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), `"content":"First prompt"`) {
		t.Fatalf("historical %d %s", page.Code, page.Body.String())
	}
	home := doJSON(handler, http.MethodGet, "/dome", nil)
	if !strings.Contains(home.Body.String(), `"content":"Newest prompt"`) {
		t.Fatalf("newest should be current: %s", home.Body.String())
	}
}

func TestUnauthenticatedAndGuestCannotPost(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creator, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Hello dome"}, creator)
	anon := doJSON(handler, http.MethodPost, "/dome/notes", map[string]string{"content": "hi"})
	if anon.Code != http.StatusUnauthorized {
		t.Fatalf("anon post %d %s", anon.Code, anon.Body.String())
	}
	guest := guestSession(t, store, authSvc)
	denied := doJSON(handler, http.MethodPost, "/dome/notes", map[string]string{"content": "from checkout"}, guest)
	if denied.Code != http.StatusForbidden || !strings.Contains(denied.Body.String(), "firebase_required") {
		t.Fatalf("guest post %d %s", denied.Code, denied.Body.String())
	}
}

func TestMemberCanPostReplyAndAnonymousDisplay(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creatorCookie, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	memberCookie, member := sessionFor(t, store, authSvc, "fb-m", "member@example.com", "Mina")
	doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Say something kind."}, creatorCookie)

	posted := doJSON(handler, http.MethodPost, "/dome/notes", map[string]any{
		"content":      "A public thought.",
		"emoji":        "✨",
		"shape":        "classic",
		"color":        "cream",
		"is_anonymous": false,
	}, memberCookie)
	if posted.Code != http.StatusOK {
		t.Fatalf("note %d %s", posted.Code, posted.Body.String())
	}
	if !strings.Contains(posted.Body.String(), `"author_name":"Mina"`) {
		t.Fatalf("named note should show author: %s", posted.Body.String())
	}
	var root struct {
		UUID string `json:"uuid"`
	}
	if err := json.Unmarshal(posted.Body.Bytes(), &root); err != nil {
		t.Fatal(err)
	}

	anon := doJSON(handler, http.MethodPost, "/dome/notes", map[string]any{
		"content":      "Secretly kind.",
		"is_anonymous": true,
		"parent_uuid":  root.UUID,
	}, memberCookie)
	if anon.Code != http.StatusOK {
		t.Fatalf("anon reply %d %s", anon.Code, anon.Body.String())
	}
	if strings.Contains(anon.Body.String(), `"author_name":"Mina"`) {
		t.Fatalf("anonymous display must hide name: %s", anon.Body.String())
	}
	if !strings.Contains(anon.Body.String(), `"author_id":`) || !strings.Contains(anon.Body.String(), `"is_anonymous":true`) {
		t.Fatalf("authorship must stay stored: %s", anon.Body.String())
	}
	if !strings.Contains(anon.Body.String(), `"parent_uuid":"`+root.UUID+`"`) {
		t.Fatalf("reply must keep parent: %s", anon.Body.String())
	}

	members := doJSON(handler, http.MethodGet, "/dome/members", nil, creatorCookie)
	if members.Code != http.StatusOK || !strings.Contains(members.Body.String(), "member@example.com") {
		t.Fatalf("implicit membership missing: %d %s", members.Code, members.Body.String())
	}
	if !strings.Contains(members.Body.String(), `"id":`) {
		t.Fatalf("member list %s", members.Body.String())
	}
	_ = member
}

func TestMemberCannotCreatePromptOrListMembers(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creatorCookie, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	memberCookie, _ := sessionFor(t, store, authSvc, "fb-m", "member@example.com", "Mina")
	doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Open"}, creatorCookie)
	deniedPrompt := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Hijack"}, memberCookie)
	if deniedPrompt.Code != http.StatusForbidden {
		t.Fatalf("member prompt %d %s", deniedPrompt.Code, deniedPrompt.Body.String())
	}
	deniedMembers := doJSON(handler, http.MethodGet, "/dome/members", nil, memberCookie)
	if deniedMembers.Code != http.StatusForbidden {
		t.Fatalf("member list %d %s", deniedMembers.Code, deniedMembers.Body.String())
	}
}

func TestEmptyDomeHasNoCommunityUntilFirstPrompt(t *testing.T) {
	handler, _, _, _ := testAPI()
	home := doJSON(handler, http.MethodGet, "/dome", nil)
	if home.Code != http.StatusOK {
		t.Fatalf("home %d %s", home.Code, home.Body.String())
	}
	if !strings.Contains(home.Body.String(), `"community":null`) {
		t.Fatalf("expected null community: %s", home.Body.String())
	}
}

func TestNoteShareIdentifierIsStable(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creatorCookie, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	memberCookie, _ := sessionFor(t, store, authSvc, "fb-m", "member@example.com", "Mina")
	created := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Share me"}, creatorCookie)
	var prompt struct {
		Prompt struct {
			ShareSlug string `json:"share_slug"`
		} `json:"prompt"`
	}
	_ = json.Unmarshal(created.Body.Bytes(), &prompt)
	note := doJSON(handler, http.MethodPost, "/dome/notes", map[string]string{"content": "Keep this"}, memberCookie)
	var posted struct {
		UUID      string `json:"uuid"`
		ShareSlug string `json:"share_slug"`
		ID        int64  `json:"id"`
	}
	if err := json.Unmarshal(note.Body.Bytes(), &posted); err != nil {
		t.Fatal(err)
	}
	if posted.UUID == "" || posted.UUID != posted.ShareSlug {
		t.Fatalf("note ids %+v", posted)
	}
	page := doJSON(handler, http.MethodGet, "/dome/prompts/"+prompt.Prompt.ShareSlug, nil)
	if !strings.Contains(page.Body.String(), `"uuid":"`+posted.UUID+`"`) {
		t.Fatalf("share page missing note: %s", page.Body.String())
	}
}

func TestMineNotesRequiresSession(t *testing.T) {
	handler, store, authSvc, _ := testAPI()
	creatorCookie, _ := sessionFor(t, store, authSvc, "fb-c", "creator@example.com", "Ada")
	memberCookie, _ := sessionFor(t, store, authSvc, "fb-m", "member@example.com", "Mina")
	created := doJSON(handler, http.MethodPost, "/dome/prompts", map[string]string{"content": "Filter"}, creatorCookie)
	var prompt struct {
		Prompt struct {
			ShareSlug string `json:"share_slug"`
		} `json:"prompt"`
	}
	_ = json.Unmarshal(created.Body.Bytes(), &prompt)
	doJSON(handler, http.MethodPost, "/dome/notes", map[string]string{"content": "mine"}, memberCookie)
	anon := doJSON(handler, http.MethodGet, "/dome/prompts/"+prompt.Prompt.ShareSlug+"/notes?mine=1", nil)
	if anon.Code != http.StatusOK || strings.TrimSpace(anon.Body.String()) != "[]\n" && strings.TrimSpace(anon.Body.String()) != "[]" {
		if !strings.Contains(anon.Body.String(), "[]") {
			t.Fatalf("anon mine %s", anon.Body.String())
		}
	}
	mine := doJSON(handler, http.MethodGet, "/dome/prompts/"+prompt.Prompt.ShareSlug+"/notes?mine=1", nil, memberCookie)
	if mine.Code != http.StatusOK || !strings.Contains(mine.Body.String(), `"content":"mine"`) {
		t.Fatalf("mine %d %s", mine.Code, mine.Body.String())
	}
}
