package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"hotly-opensource/server/pkg/db"
)

type pgStore struct {
	q *db.Queries
}

func NewPGStore(q *db.Queries) Store {
	return &pgStore{q: q}
}

func text(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}

func timestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func userFromDB(u *db.User) *User {
	if u == nil {
		return nil
	}
	out := &User{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName}
	if u.FirebaseUid.Valid {
		out.FirebaseUID = u.FirebaseUid.String
	}
	return out
}

func (p *pgStore) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u, err := p.q.GetUserByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return userFromDB(u), err
}

func (p *pgStore) GetUserByFirebaseUID(ctx context.Context, uid string) (*User, error) {
	u, err := p.q.GetUserByFirebaseUID(ctx, text(uid))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return userFromDB(u), err
}

func (p *pgStore) GetUserByID(ctx context.Context, id int64) (*User, error) {
	u, err := p.q.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return userFromDB(u), err
}

func (p *pgStore) CreateUser(ctx context.Context, uid, email, name string) (*User, error) {
	u, err := p.q.CreateUser(ctx, db.CreateUserParams{
		FirebaseUid: text(uid),
		Email:       email,
		DisplayName: name,
	})
	return userFromDB(u), err
}

func (p *pgStore) UpdateUserFirebase(ctx context.Context, id int64, uid, name string) error {
	return p.q.UpdateUserFirebase(ctx, db.UpdateUserFirebaseParams{
		ID:          id,
		FirebaseUid: text(uid),
		DisplayName: name,
	})
}

func (p *pgStore) GetCreatorUserID(ctx context.Context) (*CreatorRow, error) {
	c, err := p.q.GetCreator(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row := &CreatorRow{}
	if c.UserID.Valid {
		row.UserID = c.UserID.Int64
		row.Linked = true
	}
	return row, nil
}

func (p *pgStore) UpsertCreatorUser(ctx context.Context, email, displayName, supportItem string, oneTimeCents int64, oneTimeLimit int32, weeklyCents, userID int64) error {
	_, err := p.q.UpsertCreatorUser(ctx, db.UpsertCreatorUserParams{
		Email:                 email,
		DisplayName:           displayName,
		SupportItem:           supportItem,
		OneTimePriceCents:     oneTimeCents,
		OneTimeCharacterLimit: oneTimeLimit,
		WeeklyPriceCents:      weeklyCents,
		UserID:                pgtype.Int8{Int64: userID, Valid: true},
	})
	return err
}

func (p *pgStore) RevokeSessionsForUser(ctx context.Context, userID int64) error {
	return p.q.RevokeSessionsForUser(ctx, userID)
}

func (p *pgStore) CreateSession(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) (*Session, error) {
	s, err := p.q.CreateSession(ctx, db.CreateSessionParams{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: timestamptz(expiresAt),
	})
	if err != nil {
		return nil, err
	}
	return &Session{ID: s.ID, UserID: s.UserID}, nil
}

func (p *pgStore) GetValidSession(ctx context.Context, tokenHash string) (*Session, error) {
	s, err := p.q.GetValidSessionByTokenHash(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &Session{ID: s.ID, UserID: s.UserID}, nil
}

func (p *pgStore) RevokeSession(ctx context.Context, id int64) error {
	return p.q.RevokeSession(ctx, id)
}
