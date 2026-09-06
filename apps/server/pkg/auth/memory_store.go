package auth

import (
	"context"
	"strings"
	"sync"
	"time"
)

type memSession struct {
	Session
	expiresAt time.Time
}

type memStore struct {
	mu           sync.Mutex
	users        map[int64]*User
	byEmail      map[string]int64
	byFirebase   map[string]int64
	sessions     map[string]*memSession
	sessionsByID map[int64]*memSession
	revoked      map[int64]bool
	nextUser     int64
	nextSess     int64
	creator      *CreatorRow
}

func NewMemoryStore() Store {
	return newMemStore()
}

func newMemStore() *memStore {
	return &memStore{
		users:        map[int64]*User{},
		byEmail:      map[string]int64{},
		byFirebase:   map[string]int64{},
		sessions:     map[string]*memSession{},
		sessionsByID: map[int64]*memSession{},
		revoked:      map[int64]bool{},
		nextUser:     1,
		nextSess:     1,
	}
}

func (m *memStore) GetUserByEmail(_ context.Context, email string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byEmail[strings.ToLower(email)]
	if !ok {
		return nil, nil
	}
	u := *m.users[id]
	return &u, nil
}

func (m *memStore) GetUserByFirebaseUID(_ context.Context, uid string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byFirebase[uid]
	if !ok {
		return nil, nil
	}
	u := *m.users[id]
	return &u, nil
}

func (m *memStore) GetUserByID(_ context.Context, id int64) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return nil, nil
	}
	cp := *u
	return &cp, nil
}

func (m *memStore) CreateUser(_ context.Context, uid, email, name string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextUser
	m.nextUser++
	u := &User{ID: id, Email: email, DisplayName: name, FirebaseUID: uid}
	m.users[id] = u
	m.byEmail[strings.ToLower(email)] = id
	if uid != "" {
		m.byFirebase[uid] = id
	}
	cp := *u
	return &cp, nil
}

func (m *memStore) UpdateUserFirebase(_ context.Context, id int64, uid, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	u := m.users[id]
	if u == nil {
		return nil
	}
	if u.FirebaseUID != "" {
		delete(m.byFirebase, u.FirebaseUID)
	}
	u.FirebaseUID = uid
	if name != "" {
		u.DisplayName = name
	}
	m.byFirebase[uid] = id
	return nil
}

func (m *memStore) GetCreatorUserID(_ context.Context) (*CreatorRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.creator == nil {
		return nil, nil
	}
	cp := *m.creator
	return &cp, nil
}

func (m *memStore) UpsertCreatorUser(_ context.Context, _, _, _ string, _ int64, _ int32, _, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.creator = &CreatorRow{UserID: userID, Linked: true}
	return nil
}

func (m *memStore) RevokeSessionsForUser(_ context.Context, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for hash, sess := range m.sessions {
		if sess.UserID == userID {
			m.revoked[sess.ID] = true
			delete(m.sessions, hash)
		}
	}
	return nil
}

func (m *memStore) CreateSession(_ context.Context, userID int64, tokenHash string, expiresAt time.Time) (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextSess
	m.nextSess++
	sess := &memSession{Session: Session{ID: id, UserID: userID}, expiresAt: expiresAt}
	m.sessions[tokenHash] = sess
	m.sessionsByID[id] = sess
	return &sess.Session, nil
}

func (m *memStore) GetValidSession(_ context.Context, tokenHash string) (*Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	sess, ok := m.sessions[tokenHash]
	if !ok || m.revoked[sess.ID] || time.Now().After(sess.expiresAt) {
		return nil, nil
	}
	cp := sess.Session
	return &cp, nil
}

func (m *memStore) expireAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	past := time.Now().Add(-time.Second)
	for _, sess := range m.sessions {
		sess.expiresAt = past
	}
}

func (m *memStore) RevokeSession(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.revoked[id] = true
	for hash, sess := range m.sessions {
		if sess.ID == id {
			delete(m.sessions, hash)
		}
	}
	return nil
}

type stubVerifier struct {
	ident Identity
	err   error
}

func (s stubVerifier) VerifyIDToken(context.Context, string) (Identity, error) {
	return s.ident, s.err
}
