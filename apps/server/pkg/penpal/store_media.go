package penpal

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"hotly-opensource/server/pkg/db"
)

func (p *pgRepo) conversationMedia(ctx context.Context, msgs []*db.Message, guestUserID int64) ([]*db.MediaObject, map[int64]bool, error) {
	ids := make([]int64, 0, len(msgs))
	for _, m := range msgs {
		ids = append(ids, m.ID)
	}
	var mediaRows []*db.MediaObject
	if len(ids) > 0 {
		rows, err := p.q.ListMediaByMessageIDs(ctx, ids)
		if err != nil {
			return nil, nil, err
		}
		mediaRows = rows
	}
	unlocks := map[int64]bool{}
	if guestUserID > 0 {
		rows, err := p.q.ListUnlocksForGuest(ctx, guestUserID)
		if err != nil {
			return nil, nil, err
		}
		for _, id := range rows {
			unlocks[id] = true
		}
	}
	return mediaRows, unlocks, nil
}

func (p *pgRepo) CreateUnlockCheckout(ctx context.Context, email string, guestUserID, messageID, amountCents int64) (*db.Checkout, error) {
	return p.q.CreateCheckout(ctx, db.CreateCheckoutParams{
		Kind:            "paid_content",
		GuestEmail:      email,
		AmountCents:     amountCents,
		TargetMessageID: int8(messageID),
		GuestUserID:     int8(guestUserID),
	})
}

func (p *pgRepo) InsertMediaObject(ctx context.Context, obj *db.MediaObject) (*db.MediaObject, error) {
	return p.q.InsertMediaObject(ctx, db.InsertMediaObjectParams{
		ObjectKey:        obj.ObjectKey,
		Purpose:          obj.Purpose,
		Kind:             obj.Kind,
		ContentType:      obj.ContentType,
		ByteSize:         obj.ByteSize,
		OriginalFilename: obj.OriginalFilename,
		UploadedByUserID: obj.UploadedByUserID,
	})
}

func (p *pgRepo) GetMediaObject(ctx context.Context, id int64) (*db.MediaObject, error) {
	row, err := p.q.GetMediaObjectByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) GetMediaObjectByKey(ctx context.Context, key string) (*db.MediaObject, error) {
	row, err := p.q.GetMediaObjectByKey(ctx, key)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) DeleteUnattachedMedia(ctx context.Context, id int64) error {
	return p.q.DeleteMediaObject(ctx, id)
}

func (p *pgRepo) SetCreatorAvatarKey(ctx context.Context, key string) (*db.Creator, error) {
	row, err := p.q.SetCreatorAvatarKey(ctx, text(key))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return row, err
}

func (p *pgRepo) GetMessage(ctx context.Context, id int64) (*db.Message, error) {
	row, err := p.q.GetMessageByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return row, err
}

func (p *pgRepo) GuestHasUnlock(ctx context.Context, messageID, guestUserID int64) (bool, error) {
	_, err := p.q.GetContentUnlock(ctx, db.GetContentUnlockParams{MessageID: messageID, GuestUserID: guestUserID})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (p *pgEventStore) InsertUnlock(ctx context.Context, messageID, guestUserID, checkoutID int64) error {
	_, err := p.q.InsertContentUnlock(ctx, db.InsertContentUnlockParams{
		MessageID:   messageID,
		GuestUserID: guestUserID,
		CheckoutID:  checkoutID,
	})
	return err
}
