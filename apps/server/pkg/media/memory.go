package media

import (
	"bytes"
	"context"
	"io"
	"sync"
)

type Object struct {
	ContentType string
	Bytes       []byte
}

type Memory struct {
	mu   sync.Mutex
	data map[string]Object
}

func NewMemory() *Memory {
	return &Memory{data: map[string]Object{}}
}

func (m *Memory) Put(_ context.Context, key, contentType string, r io.Reader, _ int64) error {
	raw, err := io.ReadAll(r)
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = Object{ContentType: contentType, Bytes: raw}
	return nil
}

func (m *Memory) Get(_ context.Context, key string) (io.ReadCloser, string, int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	obj, ok := m.data[key]
	if !ok {
		return nil, "", 0, ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(obj.Bytes)), obj.ContentType, int64(len(obj.Bytes)), nil
}

func (m *Memory) Delete(_ context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.data, key)
	return nil
}

func (m *Memory) Has(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.data[key]
	return ok
}

func (m *Memory) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.data)
}
