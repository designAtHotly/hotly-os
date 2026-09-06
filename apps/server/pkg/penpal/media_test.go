package penpal

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/billing"
)

var tinyPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
}

func postMultipart(handler http.Handler, path, field, filename string, data []byte, cookie *http.Cookie) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, _ := mw.CreateFormFile(field, filename)
	_, _ = part.Write(data)
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestCreatorCanAttachImageAndGuestCanDownload(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_media_1","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	guest := claimCookie(t, handler, sessionID)
	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)

	up := postMultipart(handler, "/creator/media", "file", "note.png", tinyPNG, creator)
	if up.Code != http.StatusOK {
		t.Fatalf("upload %d %s", up.Code, up.Body.String())
	}
	var uploaded struct {
		ObjectKey string `json:"object_key"`
	}
	if err := json.Unmarshal(up.Body.Bytes(), &uploaded); err != nil || uploaded.ObjectKey == "" {
		t.Fatalf("upload body %s", up.Body.String())
	}
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]any{
		"body":        "A photo for you.",
		"object_keys": []string{uploaded.ObjectKey},
	}, creator)
	if reply.Code != http.StatusOK {
		t.Fatalf("reply %d %s", reply.Code, reply.Body.String())
	}
	chat := doJSON(handler, http.MethodGet, "/chat", nil, guest)
	if chat.Code != http.StatusOK || !strings.Contains(chat.Body.String(), `"/api/media/`) {
		t.Fatalf("guest chat missing media url: %d %s", chat.Code, chat.Body.String())
	}
	var mediaID int64
	idx := strings.Index(chat.Body.String(), `"/api/media/`)
	rest := chat.Body.String()[idx+len(`"/api/media/`):]
	if i := strings.IndexAny(rest, `"`); i > 0 {
		n, _ := strconv.ParseInt(rest[:i], 10, 64)
		mediaID = n
	}
	if mediaID == 0 {
		t.Fatal("missing media id")
	}
	dl := doJSON(handler, http.MethodGet, "/media/"+strconv.FormatInt(mediaID, 10), nil, guest)
	if dl.Code != http.StatusOK || !bytes.Equal(dl.Body.Bytes(), tinyPNG) {
		t.Fatalf("download %d", dl.Code)
	}
}

func TestGuestCannotUploadAndPlainTextIsRejected(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_media_2","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	guest := claimCookie(t, handler, sessionID)
	denied := postMultipart(handler, "/creator/media", "file", "note.png", tinyPNG, guest)
	if denied.Code != http.StatusForbidden && denied.Code != http.StatusUnauthorized {
		t.Fatalf("guest upload %d %s", denied.Code, denied.Body.String())
	}
	creator := creatorSession(t, mem, authSvc)
	bad := postMultipart(handler, "/creator/media", "file", "note.txt", []byte("hello"), creator)
	if bad.Code != http.StatusBadRequest || !strings.Contains(bad.Body.String(), "unsupported_media_type") {
		t.Fatalf("text upload %d %s", bad.Code, bad.Body.String())
	}
}

func TestPaidAttachmentStaysLockedUntilUnlockCheckout(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_media_3","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	guest := claimCookie(t, handler, sessionID)
	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)
	up := postMultipart(handler, "/creator/media", "file", "note.png", tinyPNG, creator)
	var uploaded struct {
		ObjectKey string `json:"object_key"`
	}
	_ = json.Unmarshal(up.Body.Bytes(), &uploaded)
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]any{
		"body":               "Paid photo.",
		"object_keys":        []string{uploaded.ObjectKey},
		"unlock_price_cents": 300,
	}, creator)
	if reply.Code != http.StatusOK {
		t.Fatalf("paid reply %d %s", reply.Code, reply.Body.String())
	}
	chat := doJSON(handler, http.MethodGet, "/chat", nil, guest)
	if chat.Code != http.StatusOK || !strings.Contains(chat.Body.String(), `"is_unlocked":false`) {
		t.Fatalf("expected locked chat %s", chat.Body.String())
	}
	if strings.Contains(chat.Body.String(), `"/api/media/`) {
		t.Fatalf("locked chat must not leak media url: %s", chat.Body.String())
	}
	thread := doJSON(handler, http.MethodGet, "/creator/inbox/"+strconv.FormatInt(id, 10), nil, creator)
	var body struct {
		Messages []struct {
			ID int64 `json:"id"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(thread.Body.Bytes(), &body); err != nil || len(body.Messages) < 2 {
		t.Fatalf("thread %s", thread.Body.String())
	}
	msgID := body.Messages[len(body.Messages)-1].ID
	unlock := doJSON(handler, http.MethodPost, "/chat/unlock", map[string]any{"message_id": msgID, "amount": 1}, guest)
	if unlock.Code != http.StatusOK {
		t.Fatalf("unlock checkout %d %s", unlock.Code, unlock.Body.String())
	}
	if fake.Last.AmountCents != 300 || fake.Last.Recurring {
		t.Fatalf("server must charge unlock cents, got %+v", fake.Last)
	}
	beforeCount := mem.MessageCount()
	wh := postWebhook(handler, `{"id":"evt_unlock_1","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":300,"payment_status":"paid"}`)
	if wh.Code != http.StatusOK {
		t.Fatalf("unlock webhook %d %s", wh.Code, wh.Body.String())
	}
	if mem.MessageCount() != beforeCount {
		t.Fatal("paid unlock must not create another chat message")
	}
	replay := postWebhook(handler, `{"id":"evt_unlock_1","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":300,"payment_status":"paid"}`)
	if replay.Code != http.StatusOK {
		t.Fatalf("replay %d", replay.Code)
	}
	opened := doJSON(handler, http.MethodGet, "/chat", nil, guest)
	if opened.Code != http.StatusOK || !strings.Contains(opened.Body.String(), `"is_unlocked":true`) || !strings.Contains(opened.Body.String(), `"/api/media/`) {
		t.Fatalf("after unlock %s", opened.Body.String())
	}
}

func TestTooManyAttachmentsRejected(t *testing.T) {
	handler, fake, mem, authSvc := testAPI()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_media_4","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)
	keys := make([]string, 11)
	for i := range keys {
		up := postMultipart(handler, "/creator/media", "file", "note.png", tinyPNG, creator)
		var uploaded struct {
			ObjectKey string `json:"object_key"`
		}
		_ = json.Unmarshal(up.Body.Bytes(), &uploaded)
		keys[i] = uploaded.ObjectKey
	}
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]any{
		"object_keys": keys,
	}, creator)
	if reply.Code != http.StatusBadRequest || !strings.Contains(reply.Body.String(), "too_many_attachments") {
		t.Fatalf("11 attachments %d %s", reply.Code, reply.Body.String())
	}
}

func TestMediaUploadRequiresStore(t *testing.T) {
	mem := NewMem()
	cfg := testCfg()
	authSvc := auth.NewService(mem, nil, auth.CreatorSettings{Email: cfg.CreatorEmail}, false)
	h := NewHandler(cfg, NewService(cfg, mem, billing.NewFake(), nil, nil), authSvc)
	r := chi.NewRouter()
	Mount(r, h)
	cookie := creatorSession(t, mem, authSvc)
	rec := postMultipart(r, "/creator/media", "file", "note.png", tinyPNG, cookie)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured media %d %s", rec.Code, rec.Body.String())
	}
}
