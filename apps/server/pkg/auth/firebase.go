package auth

import (
	"context"
	"strings"

	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

type firebaseVerifier struct {
	client *firebaseAuth.Client
}

func NewFirebaseVerifier(ctx context.Context, credentials string) (Verifier, error) {
	var opts []option.ClientOption
	trim := strings.TrimSpace(credentials)
	if strings.HasPrefix(trim, "{") {
		opts = append(opts, option.WithCredentialsJSON([]byte(trim)))
	} else if trim != "" {
		opts = append(opts, option.WithCredentialsFile(trim))
	}
	app, err := firebase.NewApp(ctx, nil, opts...)
	if err != nil {
		return nil, err
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, err
	}
	return &firebaseVerifier{client: client}, nil
}

func (f *firebaseVerifier) VerifyIDToken(ctx context.Context, idToken string) (Identity, error) {
	tok, err := f.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return Identity{}, err
	}
	email, _ := tok.Claims["email"].(string)
	name, _ := tok.Claims["name"].(string)
	return Identity{UID: tok.UID, Email: email, Name: name}, nil
}
