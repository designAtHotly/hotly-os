package auth

import "context"

type Identity struct {
	UID   string
	Email string
	Name  string
}

type Verifier interface {
	VerifyIDToken(ctx context.Context, idToken string) (Identity, error)
}
