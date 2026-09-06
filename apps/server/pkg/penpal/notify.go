package penpal

import (
	"context"
	"log/slog"
	"strings"

	"hotly-opensource/server/pkg/mailer"
)

func (s *Service) appURL(path string) string {
	return strings.TrimRight(s.cfg.PublicAppURL, "/") + path
}

func (s *Service) notifyCreatorPaid(ctx context.Context, notice paidNotice) {
	if notice.kind == "" || s.mail == nil || strings.TrimSpace(s.cfg.CreatorEmail) == "" {
		return
	}
	subject, text, html, err := mailer.Render("creator_paid", map[string]string{
		"KIND":  notice.kind,
		"INBOX": s.appURL("/creator/inbox"),
	})
	if err != nil {
		slog.Error("creator paid notice template failed")
		return
	}
	if err := s.mail.Send(ctx, mailer.Message{
		To:      s.cfg.CreatorEmail,
		Subject: subject,
		Text:    text,
		HTML:    html,
	}); err != nil {
		slog.Error("creator paid notice send failed", "err", err.Error())
	}
}

func (s *Service) notifyGuestReply(ctx context.Context, conversationID int64) {
	if s.mail == nil {
		return
	}
	item, err := s.repo.InboxThread(ctx, conversationID)
	if err != nil || item == nil || strings.TrimSpace(item.GuestEmail) == "" {
		return
	}
	if item.Conversation != nil && item.Conversation.BlockedAt.Valid {
		return
	}
	subject, text, html, err := mailer.Render("guest_reply", map[string]string{
		"CHAT": s.appURL("/chat"),
	})
	if err != nil {
		slog.Error("guest reply notice template failed")
		return
	}
	if err := s.mail.Send(ctx, mailer.Message{
		To:      item.GuestEmail,
		Subject: subject,
		Text:    text,
		HTML:    html,
	}); err != nil {
		slog.Error("guest reply notice send failed", "err", err.Error())
	}
}
