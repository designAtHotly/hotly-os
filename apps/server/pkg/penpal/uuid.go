package penpal

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func publicIDString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return uuid.UUID(u.Bytes).String()
}

func parsePublicID(s string) (pgtype.UUID, error) {
	parsed, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: parsed, Valid: true}, nil
}

func text(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}

func int8(n int64) pgtype.Int8 {
	return pgtype.Int8{Int64: n, Valid: true}
}

func int4(n int32) pgtype.Int4 {
	return pgtype.Int4{Int32: n, Valid: true}
}

func optionalInt8(n int64) pgtype.Int8 {
	if n <= 0 {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: n, Valid: true}
}
