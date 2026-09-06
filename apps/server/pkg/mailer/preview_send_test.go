package mailer

import (
	"context"
	"os"
	"strings"
	"testing"

	"hotly-opensource/server/pkg/config"
)

func TestLivePreviewSend(t *testing.T) {
	if os.Getenv("HOTLY_MAIL_PREVIEW") != "1" {
		t.Skip("opt-in: HOTLY_MAIL_PREVIEW=1 sends the three templates through SendGrid")
	}
	sg := config.SendGridConfig{
		APIKey:    os.Getenv("SENDGRID_API_KEY"),
		FromEmail: strings.TrimSpace(os.Getenv("SENDGRID_FROM_EMAIL")),
		FromName:  strings.TrimSpace(os.Getenv("SENDGRID_FROM_NAME")),
	}
	if !sg.Configured() {
		t.Fatal("SendGrid is not configured")
	}
	to := strings.TrimSpace(os.Getenv("CREATOR_EMAIL"))
	if to == "" {
		t.Fatal("CREATOR_EMAIL is empty")
	}
	origin := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")), "/")
	if origin == "" {
		origin = "http://localhost"
	}
	sender := NewSendGrid(sg)
	ctx := context.Background()
	jobs := []struct {
		name string
		vars map[string]string
	}{
		{"recovery", map[string]string{"LINK": origin + "/auth/chat-recovery?token=preview"}},
		{"creator_paid", map[string]string{"KIND": "note", "INBOX": origin + "/creator/inbox"}},
		{"guest_reply", map[string]string{"CHAT": origin + "/chat"}},
	}
	for _, job := range jobs {
		subject, text, html, err := Render(job.name, job.vars)
		if err != nil {
			t.Fatalf("%s render: %v", job.name, err)
		}
		if err := sender.Send(ctx, Message{To: to, Subject: subject, Text: text, HTML: html}); err != nil {
			t.Fatalf("%s send: %v", job.name, err)
		}
	}
}
