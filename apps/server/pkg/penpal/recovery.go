package penpal

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"log/slog"
	"net/mail"
	"strings"
	"time"

	"hotly-opensource/server/pkg/mailer"
)

const recoveryTTL = 24 * time.Hour

func hashRecoveryToken(secret, token string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(token))
	return hex.EncodeToString(mac.Sum(nil))
}

func newRecoveryToken() (string, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw[:]), nil
}

func (s *Service) RequestRecovery(ctx context.Context, email string) error {
	if s.mail == nil {
		return ErrSendGridNotConfigured
	}
	email = strings.TrimSpace(email)
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrInvalidEmail
	}
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}
	chat, err := s.repo.GuestChat(ctx, user.ID)
	if err != nil {
		return err
	}
	if chat == nil || chat.Conversation == nil || chat.Conversation.BlockedAt.Valid {
		return nil
	}
	raw, err := newRecoveryToken()
	if err != nil {
		return err
	}
	expires := time.Now().UTC().Add(recoveryTTL)
	if err := s.repo.CreateRecoveryToken(ctx, chat.Conversation.ID, user.ID, hashRecoveryToken(s.cfg.RecoveryTokenSecret, raw), expires); err != nil {
		return err
	}
	link := strings.TrimRight(s.cfg.PublicAppURL, "/") + "/auth/chat-recovery?token=" + raw
	subject, text, html, err := mailer.Render("recovery", map[string]string{"LINK": link})
	if err != nil {
		return err
	}
	if err := s.mail.Send(ctx, mailer.Message{
		To:      email,
		Subject: subject,
		Text:    text,
		HTML:    html,
	}); err != nil {
		slog.Error("recovery send failed", "err", err.Error())
		return err
	}
	return nil
}

func (s *Service) ConsumeRecovery(ctx context.Context, rawToken string) (int64, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return 0, ErrNotFound
	}
	row, err := s.repo.LookupRecoveryToken(ctx, hashRecoveryToken(s.cfg.RecoveryTokenSecret, rawToken))
	if err != nil {
		return 0, err
	}
	if row == nil {
		return 0, ErrNotFound
	}
	ok, err := s.repo.ConsumeRecoveryToken(ctx, row.ID)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, ErrNotFound
	}
	chat, err := s.repo.GuestChat(ctx, row.GuestUserID)
	if err != nil {
		return 0, err
	}
	if chat == nil {
		return 0, ErrNotFound
	}
	if chat.Conversation != nil && chat.Conversation.BlockedAt.Valid {
		return 0, ErrBlocked
	}
	return row.GuestUserID, nil
}
