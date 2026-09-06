package auth

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrNotConfigured = errors.New("firebase is not configured")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrInvalidToken  = errors.New("invalid identity token")
)

type User struct {
	ID          int64
	Email       string
	DisplayName string
	FirebaseUID string
}

type Session struct {
	ID     int64
	UserID int64
}

type CreatorRow struct {
	UserID int64
	Linked bool
}

type Store interface {
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByFirebaseUID(ctx context.Context, uid string) (*User, error)
	GetUserByID(ctx context.Context, id int64) (*User, error)
	CreateUser(ctx context.Context, uid, email, name string) (*User, error)
	UpdateUserFirebase(ctx context.Context, id int64, uid, name string) error
	GetCreatorUserID(ctx context.Context) (*CreatorRow, error)
	UpsertCreatorUser(ctx context.Context, email, displayName, supportItem string, oneTimeCents int64, oneTimeLimit int32, weeklyCents, userID int64) error
	RevokeSessionsForUser(ctx context.Context, userID int64) error
	CreateSession(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) (*Session, error)
	GetValidSession(ctx context.Context, tokenHash string) (*Session, error)
	RevokeSession(ctx context.Context, id int64) error
}

type CreatorSettings struct {
	Email                 string
	DisplayName           string
	SupportItem           string
	OneTimePriceCents     int64
	OneTimeCharacterLimit int32
	WeeklyPriceCents      int64
}

type Service struct {
	store    Store
	verifier Verifier
	creator  CreatorSettings
	secure   bool
}

type Principal struct {
	User      User
	IsCreator bool
}

func NewService(store Store, verifier Verifier, creator CreatorSettings, secureCookies bool) *Service {
	return &Service{store: store, verifier: verifier, creator: creator, secure: secureCookies}
}

func (s *Service) Configured() bool {
	return s != nil && s.verifier != nil
}

func emailsEqual(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

func (s *Service) Exchange(ctx context.Context, idToken string) (rawToken string, principal Principal, expires time.Time, err error) {
	if !s.Configured() {
		return "", Principal{}, time.Time{}, ErrNotConfigured
	}
	if strings.TrimSpace(idToken) == "" {
		return "", Principal{}, time.Time{}, ErrInvalidToken
	}
	ident, err := s.verifier.VerifyIDToken(ctx, idToken)
	if err != nil {
		return "", Principal{}, time.Time{}, ErrInvalidToken
	}
	if ident.Email == "" || ident.UID == "" {
		return "", Principal{}, time.Time{}, ErrInvalidToken
	}

	user, err := s.findOrCreateUser(ctx, ident)
	if err != nil {
		return "", Principal{}, time.Time{}, err
	}

	isCreator := emailsEqual(ident.Email, s.creator.Email)
	if isCreator {
		existing, err := s.store.GetCreatorUserID(ctx)
		if err != nil {
			return "", Principal{}, time.Time{}, err
		}
		if existing != nil && existing.Linked && existing.UserID != user.ID {
			if err := s.store.RevokeSessionsForUser(ctx, existing.UserID); err != nil {
				return "", Principal{}, time.Time{}, err
			}
		}
		display := s.creator.DisplayName
		if display == "" {
			display = ident.Name
		}
		if err := s.store.UpsertCreatorUser(ctx, s.creator.Email, display, s.creator.SupportItem, s.creator.OneTimePriceCents, s.creator.OneTimeCharacterLimit, s.creator.WeeklyPriceCents, user.ID); err != nil {
			return "", Principal{}, time.Time{}, err
		}
	}

	token, err := newSessionToken()
	if err != nil {
		return "", Principal{}, time.Time{}, err
	}
	expires = time.Now().Add(sessionTTL).UTC()
	if _, err := s.store.CreateSession(ctx, user.ID, hashToken(token), expires); err != nil {
		return "", Principal{}, time.Time{}, err
	}
	return token, Principal{User: *user, IsCreator: isCreator}, expires, nil
}

func (s *Service) findOrCreateUser(ctx context.Context, ident Identity) (*User, error) {
	user, err := s.store.GetUserByFirebaseUID(ctx, ident.UID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		user, err = s.store.GetUserByEmail(ctx, ident.Email)
		if err != nil {
			return nil, err
		}
	}
	if user == nil {
		return s.store.CreateUser(ctx, ident.UID, ident.Email, ident.Name)
	}
	if err := s.store.UpdateUserFirebase(ctx, user.ID, ident.UID, ident.Name); err != nil {
		return nil, err
	}
	user.FirebaseUID = ident.UID
	if ident.Name != "" {
		user.DisplayName = ident.Name
	}
	return user, nil
}

func (s *Service) Current(ctx context.Context, rawToken string) (Principal, error) {
	if rawToken == "" {
		return Principal{}, ErrUnauthorized
	}
	sess, err := s.store.GetValidSession(ctx, hashToken(rawToken))
	if err != nil {
		return Principal{}, err
	}
	if sess == nil {
		return Principal{}, ErrUnauthorized
	}
	user, err := s.store.GetUserByID(ctx, sess.UserID)
	if err != nil {
		return Principal{}, err
	}
	if user == nil {
		return Principal{}, ErrUnauthorized
	}
	creator, err := s.store.GetCreatorUserID(ctx)
	if err != nil {
		return Principal{}, err
	}
	if creator != nil && creator.Linked && creator.UserID == user.ID && !emailsEqual(user.Email, s.creator.Email) {
		if err := s.store.RevokeSessionsForUser(ctx, user.ID); err != nil {
			return Principal{}, err
		}
		return Principal{}, ErrUnauthorized
	}
	isCreator := creator != nil && creator.Linked && creator.UserID == user.ID && emailsEqual(user.Email, s.creator.Email)
	return Principal{User: *user, IsCreator: isCreator}, nil
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	sess, err := s.store.GetValidSession(ctx, hashToken(rawToken))
	if err != nil || sess == nil {
		return err
	}
	return s.store.RevokeSession(ctx, sess.ID)
}

func (s *Service) CookieSecure() bool { return s.secure }

func (s *Service) UserByID(ctx context.Context, id int64) (*User, error) {
	if s == nil || s.store == nil {
		return nil, ErrUnauthorized
	}
	return s.store.GetUserByID(ctx, id)
}

func (s *Service) IssueSession(ctx context.Context, userID int64) (string, time.Time, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expires := time.Now().Add(sessionTTL).UTC()
	if _, err := s.store.CreateSession(ctx, userID, hashToken(token), expires); err != nil {
		return "", time.Time{}, err
	}
	return token, expires, nil
}
