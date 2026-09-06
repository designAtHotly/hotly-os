package mailer

import (
	"context"
	"embed"
	"strings"
)

//go:embed templates/*.txt templates/*.html
var templates embed.FS

type Message struct {
	To      string
	Subject string
	Text    string
	HTML    string
}

type Sender interface {
	Send(ctx context.Context, msg Message) error
}

func Render(name string, vars map[string]string) (subject, text, html string, err error) {
	rawTxt, err := templates.ReadFile("templates/" + name + ".txt")
	if err != nil {
		return "", "", "", err
	}
	rawHTML, err := templates.ReadFile("templates/" + name + ".html")
	if err != nil {
		return "", "", "", err
	}
	txt := string(rawTxt)
	html = string(rawHTML)
	for k, v := range vars {
		txt = strings.ReplaceAll(txt, "{{"+k+"}}", v)
		html = strings.ReplaceAll(html, "{{"+k+"}}", v)
	}
	subject = "Penpal"
	if i := strings.Index(txt, "\n"); i > 0 && strings.HasPrefix(txt, "Subject: ") {
		subject = strings.TrimSpace(txt[len("Subject: "):i])
		txt = strings.TrimSpace(txt[i+1:])
	}
	return subject, txt, html, nil
}
