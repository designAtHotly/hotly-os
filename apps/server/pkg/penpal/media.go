package penpal

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"path"
	"strings"

	"github.com/google/uuid"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/db"
	"hotly-opensource/server/pkg/media"
)

func (s *Service) Upload(ctx context.Context, userID int64, purpose, filename string, body io.Reader) (*db.MediaObject, error) {
	if s.blobs == nil {
		return nil, ErrMediaNotConfigured
	}
	if purpose != "avatar" {
		purpose = "attachment"
	}
	detected, r, err := media.Detect(body)
	if err != nil {
		return nil, err
	}
	if purpose == "avatar" && detected.Kind != media.KindImage {
		return nil, media.ErrUnsupportedType
	}
	limit := media.Limit(purpose)
	limited := &limitedReader{r: r, max: limit}
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, limited); err != nil {
		if err == media.ErrTooLarge {
			return nil, err
		}
		return nil, err
	}
	if buf.Len() == 0 {
		return nil, media.ErrUnsupportedType
	}
	key := path.Join(purpose+"s", uuid.NewString())
	size := int64(buf.Len())
	if err := s.blobs.Put(ctx, key, detected.ContentType, bytes.NewReader(buf.Bytes()), size); err != nil {
		_ = s.blobs.Delete(ctx, key)
		if err == media.ErrTooLarge {
			return nil, err
		}
		slog.Error("media put failed", "purpose", purpose)
		return nil, err
	}
	obj, err := s.repo.InsertMediaObject(ctx, &db.MediaObject{
		ObjectKey:        key,
		Purpose:          purpose,
		Kind:             string(detected.Kind),
		ContentType:      detected.ContentType,
		ByteSize:         size,
		OriginalFilename: filename,
		UploadedByUserID: userID,
	})
	if err != nil {
		_ = s.blobs.Delete(ctx, key)
		slog.Error("media insert failed", "purpose", purpose)
		return nil, err
	}
	if purpose == "avatar" {
		prev, _ := s.repo.GetCreator(ctx)
		if _, err := s.repo.SetCreatorAvatarKey(ctx, key); err != nil {
			_ = s.repo.DeleteUnattachedMedia(ctx, obj.ID)
			_ = s.blobs.Delete(ctx, key)
			return nil, err
		}
		if prev != nil && prev.AvatarObjectKey.Valid && prev.AvatarObjectKey.String != key {
			_ = s.blobs.Delete(ctx, prev.AvatarObjectKey.String)
		}
	}
	return obj, nil
}

func (s *Service) Reply(ctx context.Context, in CreatorReply) (*db.Message, error) {
	in.Body = strings.TrimSpace(in.Body)
	if in.Body == "" && len(in.ObjectKeys) == 0 {
		return nil, ErrMessageRequired
	}
	if len(in.ObjectKeys) > media.MaxAttachments {
		return nil, ErrTooManyAttachments
	}
	if in.UnlockPriceCents < 0 {
		return nil, ErrInvalidUnlockPrice
	}
	msg, err := s.repo.AddCreatorReply(ctx, in)
	if err != nil {
		return nil, err
	}
	s.notifyGuestReply(ctx, in.ConversationID)
	return msg, nil
}

func (s *Service) StartUnlock(ctx context.Context, guest auth.Principal, messageID int64) (string, error) {
	if s.stripe == nil {
		return "", ErrStripeNotConfigured
	}
	if guest.IsCreator {
		return "", ErrNotFound
	}
	msg, err := s.repo.GetMessage(ctx, messageID)
	if err != nil {
		return "", err
	}
	if msg == nil || !msg.UnlockPriceCents.Valid {
		return "", ErrNotFound
	}
	chat, err := s.repo.GuestChat(ctx, guest.User.ID)
	if err != nil {
		return "", err
	}
	if chat == nil || chat.Conversation.ID != msg.ConversationID {
		return "", ErrNotFound
	}
	if chat.Conversation.BlockedAt.Valid {
		return "", ErrBlocked
	}
	if chat.Unlocks[msg.ID] {
		return "", ErrAlreadyUnlocked
	}
	row, err := s.repo.CreateUnlockCheckout(ctx, chat.GuestEmail, guest.User.ID, msg.ID, msg.UnlockPriceCents.Int64)
	if err != nil {
		return "", err
	}
	origin := strings.TrimRight(s.cfg.PublicAppURL, "/")
	sess, err := s.stripe.CreateSession(ctx, billing.SessionParams{
		CheckoutPublicID: publicIDString(row.PublicID),
		GuestEmail:       chat.GuestEmail,
		AmountCents:      msg.UnlockPriceCents.Int64,
		ProductName:      "Unlock media",
		SuccessURL:       origin + "/chat?unlock=true&session_id={CHECKOUT_SESSION_ID}",
		CancelURL:        origin + "/chat?canceled=true",
	})
	if err != nil {
		return "", err
	}
	if err := s.repo.SetCheckoutStripeSession(ctx, row.ID, sess.ID); err != nil {
		return "", err
	}
	return sess.URL, nil
}

func (s *Service) OpenAttachment(ctx context.Context, viewer auth.Principal, id int64) (*db.MediaObject, io.ReadCloser, error) {
	if s.blobs == nil {
		return nil, nil, ErrMediaNotConfigured
	}
	obj, err := s.repo.GetMediaObject(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if obj == nil || obj.Purpose != "attachment" {
		return nil, nil, ErrNotFound
	}
	if !obj.MessageID.Valid {
		if obj.UploadedByUserID != viewer.User.ID {
			return nil, nil, ErrNotFound
		}
		return s.openBlob(ctx, obj)
	}
	msg, err := s.repo.GetMessage(ctx, obj.MessageID.Int64)
	if err != nil || msg == nil {
		return nil, nil, ErrNotFound
	}
	if viewer.IsCreator {
		return s.openBlob(ctx, obj)
	}
	chat, err := s.repo.GuestChat(ctx, viewer.User.ID)
	if err != nil {
		return nil, nil, err
	}
	if chat == nil || chat.Conversation.ID != msg.ConversationID {
		return nil, nil, ErrNotFound
	}
	if chat.Conversation.BlockedAt.Valid {
		return nil, nil, ErrBlocked
	}
	if msg.UnlockPriceCents.Valid && !chat.Unlocks[msg.ID] {
		return nil, nil, ErrLocked
	}
	return s.openBlob(ctx, obj)
}

func (s *Service) OpenAvatar(ctx context.Context) (*db.MediaObject, io.ReadCloser, error) {
	if s.blobs == nil {
		return nil, nil, ErrMediaNotConfigured
	}
	creator, err := s.repo.GetCreator(ctx)
	if err != nil || creator == nil || !creator.AvatarObjectKey.Valid {
		return nil, nil, ErrNotFound
	}
	obj, err := s.repo.GetMediaObjectByKey(ctx, creator.AvatarObjectKey.String)
	if err != nil || obj == nil {
		return nil, nil, ErrNotFound
	}
	return s.openBlob(ctx, obj)
}

func (s *Service) openBlob(ctx context.Context, obj *db.MediaObject) (*db.MediaObject, io.ReadCloser, error) {
	body, _, _, err := s.blobs.Get(ctx, obj.ObjectKey)
	if err != nil {
		return nil, nil, err
	}
	return obj, body, nil
}

type limitedReader struct {
	r   io.Reader
	n   int64
	max int64
}

func (l *limitedReader) Read(p []byte) (int, error) {
	n, err := l.r.Read(p)
	l.n += int64(n)
	if l.n > l.max {
		return n, media.ErrTooLarge
	}
	return n, err
}

func mapMediaJSON(obj *db.MediaObject, locked bool) map[string]any {
	out := map[string]any{
		"id":       obj.ID,
		"filename": obj.OriginalFilename,
		"size":     obj.ByteSize,
		"type":     obj.Kind,
	}
	if locked {
		out["signed_url"] = nil
		return out
	}
	out["signed_url"] = fmt.Sprintf("/api/media/%d", obj.ID)
	return out
}

func attachmentsForMessage(mediaRows []*db.MediaObject, messageID int64, locked bool) []map[string]any {
	out := []map[string]any{}
	for _, obj := range mediaRows {
		if obj.MessageID.Valid && obj.MessageID.Int64 == messageID {
			out = append(out, mapMediaJSON(obj, locked))
		}
	}
	return out
}
