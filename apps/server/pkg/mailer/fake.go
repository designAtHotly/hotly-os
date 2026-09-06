package mailer

import (
	"context"
	"sync"
)

type Fake struct {
	mu       sync.Mutex
	Messages []Message
}

func NewFake() *Fake { return &Fake{} }

func (f *Fake) Send(_ context.Context, msg Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Messages = append(f.Messages, msg)
	return nil
}

func (f *Fake) Count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.Messages)
}

func (f *Fake) Last() *Message {
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.Messages) == 0 {
		return nil
	}
	m := f.Messages[len(f.Messages)-1]
	return &m
}
