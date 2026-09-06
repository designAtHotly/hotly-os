package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"hotly-opensource/server/pkg/config"
)

type SendGrid struct {
	apiKey    string
	fromEmail string
	fromName  string
	client    *http.Client
}

func NewSendGrid(cfg config.SendGridConfig) *SendGrid {
	return &SendGrid{
		apiKey:    cfg.APIKey,
		fromEmail: cfg.FromEmail,
		fromName:  cfg.FromName,
		client:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *SendGrid) Send(ctx context.Context, msg Message) error {
	payload := map[string]any{
		"personalizations": []map[string]any{
			{"to": []map[string]string{{"email": msg.To}}},
		},
		"from":    map[string]string{"email": s.fromEmail, "name": s.fromName},
		"subject": msg.Subject,
		"content": []map[string]string{
			{"type": "text/plain", "value": msg.Text},
			{"type": "text/html", "value": msg.HTML},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("sendgrid_status_%d", res.StatusCode)
	}
	return nil
}
