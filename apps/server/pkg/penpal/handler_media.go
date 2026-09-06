package penpal

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/media"
)

func (h *Handler) creatorUpload(w http.ResponseWriter, req *http.Request) {
	h.handleUpload(w, req, "attachment")
}

func (h *Handler) creatorAvatar(w http.ResponseWriter, req *http.Request) {
	h.handleUpload(w, req, "avatar")
}

func (h *Handler) handleUpload(w http.ResponseWriter, req *http.Request, purpose string) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	req.Body = http.MaxBytesReader(w, req.Body, media.Limit(purpose)+1024)
	mr, err := req.MultipartReader()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "multipart_required"})
		return
	}
	var filename string
	var part io.Reader
	for {
		p, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_upload"})
			return
		}
		if p.FormName() == "file" {
			filename = p.FileName()
			part = p
			break
		}
	}
	if part == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "file_required"})
		return
	}
	obj, err := h.svc.Upload(req.Context(), principal.User.ID, purpose, filename, part)
	if err != nil {
		writeUploadError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"object_key": obj.ObjectKey,
		"id":         obj.ID,
		"filename":   obj.OriginalFilename,
		"size":       obj.ByteSize,
		"type":       obj.Kind,
		"purpose":    obj.Purpose,
	})
}

func writeUploadError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrMediaNotConfigured):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "media_not_configured"})
	case errors.Is(err, media.ErrUnsupportedType):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported_media_type", "message": "Use an image or video file."})
	case errors.Is(err, media.ErrTooLarge):
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "media_too_large"})
	default:
		slog.Error("media upload failed")
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
	}
}

func (h *Handler) mediaGet(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(req, "id"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}
	obj, body, err := h.svc.OpenAttachment(req.Context(), principal, id)
	if err != nil {
		switch {
		case errors.Is(err, ErrLocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "locked"})
		case errors.Is(err, ErrBlocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		case errors.Is(err, ErrNotFound), errors.Is(err, media.ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	defer body.Close()
	w.Header().Set("Content-Type", obj.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}

func (h *Handler) avatar(w http.ResponseWriter, req *http.Request) {
	obj, body, err := h.svc.OpenAvatar(req.Context())
	if err != nil {
		if errors.Is(err, ErrNotFound) || errors.Is(err, media.ErrNotFound) || errors.Is(err, ErrMediaNotConfigured) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		return
	}
	defer body.Close()
	w.Header().Set("Content-Type", obj.ContentType)
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}

type unlockRequest struct {
	MessageID int64 `json:"message_id"`
}

func (h *Handler) unlockCheckout(w http.ResponseWriter, req *http.Request) {
	principal, ok := auth.PrincipalFrom(req.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	var body unlockRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil || body.MessageID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	url, err := h.svc.StartUnlock(req.Context(), principal, body.MessageID)
	if err != nil {
		switch {
		case errors.Is(err, ErrStripeNotConfigured):
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "stripe_not_configured"})
		case errors.Is(err, ErrAlreadyUnlocked):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already_unlocked"})
		case errors.Is(err, ErrBlocked):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "blocked"})
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal_error"})
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}
