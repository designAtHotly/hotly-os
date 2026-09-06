package mailer

import (
	"strings"
	"testing"
)

func TestRenderCheckedInTemplates(t *testing.T) {
	cases := []struct {
		name string
		vars map[string]string
		want string
	}{
		{"recovery", map[string]string{"LINK": "http://localhost/auth/chat-recovery?token=abc"}, "http://localhost/auth/chat-recovery?token=abc"},
		{"creator_paid", map[string]string{"KIND": "note", "INBOX": "http://localhost/creator/inbox"}, "http://localhost/creator/inbox"},
		{"guest_reply", map[string]string{"CHAT": "http://localhost/chat"}, "http://localhost/chat"},
	}
	for _, tc := range cases {
		subject, text, html, err := Render(tc.name, tc.vars)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		if subject == "" || text == "" || html == "" {
			t.Fatalf("%s empty template", tc.name)
		}
		if !strings.Contains(text, tc.want) || !strings.Contains(html, tc.want) {
			t.Fatalf("%s missing CTA %q", tc.name, tc.want)
		}
		if !strings.Contains(text, "Powered by Hotly") || !strings.Contains(html, "Powered by Hotly") {
			t.Fatalf("%s missing Powered by Hotly", tc.name)
		}
		if !strings.Contains(text, "https://hotly.com") || !strings.Contains(html, "https://hotly.com") {
			t.Fatalf("%s missing hotly.com footer link", tc.name)
		}
		if !strings.Contains(html, "https://hotly.com/images/new-logo.png") {
			t.Fatalf("%s missing wordmark", tc.name)
		}
		if !strings.Contains(html, "https://hotly.com/apple-touch-icon.png") {
			t.Fatalf("%s missing mark", tc.name)
		}
	}
}

func TestFakeRecordsSend(t *testing.T) {
	f := NewFake()
	if err := f.Send(nil, Message{To: "a@example.com", Subject: "Hi", Text: "body"}); err != nil {
		t.Fatal(err)
	}
	if f.Last() == nil || f.Last().To != "a@example.com" {
		t.Fatal("fake must record the message")
	}
}
