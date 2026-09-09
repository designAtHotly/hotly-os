package penpal

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"hotly-opensource/server/pkg/auth"
	"hotly-opensource/server/pkg/billing"
	"hotly-opensource/server/pkg/db"
)

type memSession struct {
	auth.Session
	expiresAt time.Time
}

type Mem struct {
	mu            sync.Mutex
	failApply     bool
	users         map[int64]*db.User
	byEmail       map[string]int64
	byFirebase    map[string]int64
	sessions      map[string]*memSession
	sessionsByID  map[int64]*memSession
	revoked       map[int64]bool
	creator       *auth.CreatorRow
	creatorRow    *db.Creator
	checkouts     map[int64]*db.Checkout
	bySession     map[string]int64
	byPublic      map[string]int64
	events        map[string]struct{}
	payments      []*db.Payment
	convos        map[int64]*db.Conversation
	convoByGuest  map[int64]int64
	messages      map[int64]*db.Message
	msgByCheckout map[int64]int64
	subs          map[string]*db.Subscription
	recoveries    map[int64]*db.ChatRecoveryToken
	media         map[int64]*db.MediaObject
	mediaByKey    map[string]int64
	unlocks       map[[2]int64]int64
	nextUser      int64
	nextSess      int64
	nextCheckout  int64
	nextPay       int64
	nextConvo     int64
	nextMsg       int64
	nextRecovery  int64
	nextMedia     int64
	nextUnlock    int64
}

func NewMem() *Mem {
	return &Mem{
		users:         map[int64]*db.User{},
		byEmail:       map[string]int64{},
		byFirebase:    map[string]int64{},
		sessions:      map[string]*memSession{},
		sessionsByID:  map[int64]*memSession{},
		revoked:       map[int64]bool{},
		checkouts:     map[int64]*db.Checkout{},
		bySession:     map[string]int64{},
		byPublic:      map[string]int64{},
		events:        map[string]struct{}{},
		convos:        map[int64]*db.Conversation{},
		convoByGuest:  map[int64]int64{},
		messages:      map[int64]*db.Message{},
		msgByCheckout: map[int64]int64{},
		nextUser:      1,
		nextSess:      1,
		nextCheckout:  1,
		nextPay:       1,
		nextConvo:     1,
		nextMsg:       1,
		nextRecovery:  1,
		nextMedia:     1,
		nextUnlock:    1,
		subs:          map[string]*db.Subscription{},
		recoveries:    map[int64]*db.ChatRecoveryToken{},
		media:         map[int64]*db.MediaObject{},
		mediaByKey:    map[string]int64{},
		unlocks:       map[[2]int64]int64{},
	}
}

func (m *Mem) FailNextApply() { m.failApply = true }

func cloneUser(u *db.User) *db.User {
	if u == nil {
		return nil
	}
	cp := *u
	return &cp
}

func cloneCheckout(c *db.Checkout) *db.Checkout {
	if c == nil {
		return nil
	}
	cp := *c
	return &cp
}

func (m *Mem) authUser(u *db.User) *auth.User {
	if u == nil {
		return nil
	}
	out := &auth.User{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName}
	if u.FirebaseUid.Valid {
		out.FirebaseUID = u.FirebaseUid.String
	}
	return out
}

func (m *Mem) GetUserByEmail(_ context.Context, email string) (*auth.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byEmail[strings.ToLower(email)]
	if !ok {
		return nil, nil
	}
	return m.authUser(m.users[id]), nil
}

func (m *Mem) GetUserByFirebaseUID(_ context.Context, uid string) (*auth.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byFirebase[uid]
	if !ok {
		return nil, nil
	}
	return m.authUser(m.users[id]), nil
}

func (m *Mem) GetUserByID(_ context.Context, id int64) (*auth.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.authUser(m.users[id]), nil
}

func (m *Mem) CreateUser(_ context.Context, uid, email, name string) (*auth.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextUser
	m.nextUser++
	u := &db.User{ID: id, Email: email, DisplayName: name, FirebaseUid: text(uid)}
	m.users[id] = u
	m.byEmail[strings.ToLower(email)] = id
	if uid != "" {
		m.byFirebase[uid] = id
	}
	return m.authUser(u), nil
}

func (m *Mem) UpdateUserFirebase(_ context.Context, id int64, uid, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	u := m.users[id]
	if u == nil {
		return nil
	}
	if u.FirebaseUid.Valid {
		delete(m.byFirebase, u.FirebaseUid.String)
	}
	u.FirebaseUid = text(uid)
	if name != "" {
		u.DisplayName = name
	}
	m.byFirebase[uid] = id
	return nil
}

func (m *Mem) GetCreatorUserID(_ context.Context) (*auth.CreatorRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.creator == nil {
		return nil, nil
	}
	cp := *m.creator
	return &cp, nil
}

func (m *Mem) UpsertCreatorUser(_ context.Context, email, displayName, supportItem string, oneTimeCents int64, oneTimeLimit int32, weeklyCents, userID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.creator = &auth.CreatorRow{UserID: userID, Linked: true}
	if m.creatorRow == nil {
		m.creatorRow = &db.Creator{
			Singleton:            true,
			WeeklyAllowanceChars: 2000,
			Price500Cents:        defaultPrice500Cents,
			Price1000Cents:       defaultPrice1000Cents,
		}
	}
	m.creatorRow.Email = email
	if displayName != "" {
		m.creatorRow.DisplayName = displayName
	}
	if supportItem != "" {
		m.creatorRow.SupportItem = supportItem
	}
	if oneTimeCents > 0 {
		m.creatorRow.OneTimePriceCents = oneTimeCents
	}
	if oneTimeLimit > 0 {
		m.creatorRow.OneTimeCharacterLimit = oneTimeLimit
	}
	if weeklyCents > 0 {
		m.creatorRow.WeeklyPriceCents = weeklyCents
	}
	m.creatorRow.UserID = int8(userID)
	return nil
}

func (m *Mem) RevokeSessionsForUser(_ context.Context, userID int64) error {
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

func (m *Mem) CreateSession(_ context.Context, userID int64, tokenHash string, expiresAt time.Time) (*auth.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextSess
	m.nextSess++
	sess := &memSession{Session: auth.Session{ID: id, UserID: userID}, expiresAt: expiresAt}
	m.sessions[tokenHash] = sess
	m.sessionsByID[id] = sess
	return &sess.Session, nil
}

func (m *Mem) GetValidSession(_ context.Context, tokenHash string) (*auth.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	sess, ok := m.sessions[tokenHash]
	if !ok || m.revoked[sess.ID] || time.Now().After(sess.expiresAt) {
		return nil, nil
	}
	cp := sess.Session
	return &cp, nil
}

func (m *Mem) RevokeSession(_ context.Context, id int64) error {
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

func (m *Mem) GetCreator(_ context.Context) (*db.Creator, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.creatorRow == nil {
		return nil, nil
	}
	cp := *m.creatorRow
	return &cp, nil
}

func (m *Mem) CreateCheckout(_ context.Context, kind, email, message string, amountCents int64, charLimit int32) (*db.Checkout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextCheckout
	m.nextCheckout++
	pub := uuid.New()
	if kind == "" {
		kind = "one_time_message"
	}
	row := &db.Checkout{
		ID:             id,
		PublicID:       pgtype.UUID{Bytes: pub, Valid: true},
		Kind:           kind,
		Status:         "pending",
		GuestEmail:     email,
		InitialMessage: text(message),
		AmountCents:    amountCents,
		Currency:       "usd",
		CharacterLimit: optionalInt4(charLimit),
		CreatedAt:      pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	m.checkouts[id] = row
	m.byPublic[pub.String()] = id
	return cloneCheckout(row), nil
}

func (m *Mem) SetCheckoutStripeSession(_ context.Context, id int64, sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	row := m.checkouts[id]
	if row == nil {
		return ErrNotFound
	}
	row.StripeCheckoutSessionID = text(sessionID)
	m.bySession[sessionID] = id
	return nil
}

func (m *Mem) GetCheckoutByStripeSession(_ context.Context, sessionID string) (*db.Checkout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.bySession[sessionID]
	if !ok {
		return nil, nil
	}
	return cloneCheckout(m.checkouts[id]), nil
}

func (m *Mem) GetCheckoutByPublicID(_ context.Context, publicID string) (*db.Checkout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.byPublic[publicID]
	if !ok {
		return nil, nil
	}
	return cloneCheckout(m.checkouts[id]), nil
}

func (m *Mem) ApplyEvent(ctx context.Context, ev billing.Event) (paidNotice, error) {
	m.mu.Lock()
	if m.failApply {
		m.failApply = false
		m.mu.Unlock()
		return paidNotice{}, errorsApplyFailed
	}
	m.mu.Unlock()
	return applyEvent(ctx, m, ev)
}

func (m *Mem) GuestChat(_ context.Context, userID int64) (*GuestChat, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cid, ok := m.convoByGuest[userID]
	if !ok {
		return nil, nil
	}
	u := m.users[userID]
	email := ""
	if u != nil {
		email = u.Email
	}
	var sub *db.Subscription
	for _, s := range m.subs {
		if s.GuestUserID == userID && subscriptionSendable(s) {
			cp := *s
			sub = &cp
			break
		}
	}
	msgs := m.messagesFor(cid)
	return &GuestChat{
		Conversation: cloneConvo(m.convos[cid]),
		GuestEmail:   email,
		Messages:     msgs,
		Subscription: sub,
		Media:        m.mediaForMessagesLocked(msgs),
		Unlocks:      m.unlocksForLocked(userID),
	}, nil
}

func (m *Mem) ListInbox(_ context.Context) ([]InboxItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]InboxItem, 0, len(m.convos))
	for _, c := range m.convos {
		msgs := m.messagesFor(c.ID)
		var last *db.Message
		if len(msgs) > 0 {
			last = msgs[len(msgs)-1]
		}
		email := ""
		if u := m.users[c.GuestUserID]; u != nil {
			email = u.Email
		}
		out = append(out, InboxItem{
			Conversation:   cloneConvo(c),
			GuestEmail:     email,
			GuestUserID:    c.GuestUserID,
			LastMessage:    last,
			TotalPaidCents: m.paidCentsLocked(c.GuestUserID),
			IsSubscriber:   m.isSubscriberLocked(c.GuestUserID),
		})
	}
	return out, nil
}

func (m *Mem) InboxThread(_ context.Context, conversationID int64) (*InboxItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.convos[conversationID]
	if c == nil {
		return nil, nil
	}
	email := ""
	if u := m.users[c.GuestUserID]; u != nil {
		email = u.Email
	}
	msgs := m.messagesFor(c.ID)
	return &InboxItem{
		Conversation:   cloneConvo(c),
		GuestEmail:     email,
		GuestUserID:    c.GuestUserID,
		Messages:       msgs,
		LastMessage:    lastMessage(msgs),
		TotalPaidCents: m.paidCentsLocked(c.GuestUserID),
		IsSubscriber:   m.isSubscriberLocked(c.GuestUserID),
		Media:          m.mediaForMessagesLocked(msgs),
	}, nil
}

func (m *Mem) AddCreatorReply(_ context.Context, in CreatorReply) (*db.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.convos[in.ConversationID]
	if c == nil {
		return nil, ErrNotFound
	}
	if len(in.ObjectKeys) > 10 {
		return nil, ErrTooManyAttachments
	}
	msg := m.addMessage(c.ID, in.AuthorUserID, 0, in.Body)
	if in.UnlockPriceCents > 0 {
		msg.UnlockPriceCents = int8(in.UnlockPriceCents)
	}
	for _, key := range in.ObjectKeys {
		id, ok := m.mediaByKey[key]
		obj := m.media[id]
		if !ok || obj == nil || obj.UploadedByUserID != in.AuthorUserID || obj.Purpose != "attachment" || obj.MessageID.Valid {
			return nil, ErrNotFound
		}
		obj.MessageID = int8(msg.ID)
	}
	c.LastActivityAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	cp := *msg
	return &cp, nil
}

func (m *Mem) SetConversationBlocked(_ context.Context, conversationID int64, blocked bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := m.convos[conversationID]
	if c == nil {
		return ErrNotFound
	}
	if blocked {
		if !c.BlockedAt.Valid {
			c.BlockedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
		}
		return nil
	}
	c.BlockedAt = pgtype.Timestamptz{}
	return nil
}

func (m *Mem) paidCentsLocked(guestID int64) int64 {
	var total int64
	for _, p := range m.payments {
		co := m.checkouts[p.CheckoutID]
		if co == nil || co.Status != "completed" || !co.GuestUserID.Valid || co.GuestUserID.Int64 != guestID {
			continue
		}
		total += p.AmountCents
	}
	return total
}

func (m *Mem) isSubscriberLocked(guestID int64) bool {
	for _, s := range m.subs {
		if s.GuestUserID == guestID && subscriptionSendable(s) {
			return true
		}
	}
	return false
}

func lastMessage(msgs []*db.Message) *db.Message {
	if len(msgs) == 0 {
		return nil
	}
	return msgs[len(msgs)-1]
}

func (m *Mem) TryInsertEvent(_ context.Context, id, _ string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.events[id]; ok {
		return false, nil
	}
	m.events[id] = struct{}{}
	return true, nil
}

func (m *Mem) LookupCheckout(_ context.Context, sessionID, publicID string) (*db.Checkout, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if sessionID != "" {
		if id, ok := m.bySession[sessionID]; ok {
			return cloneCheckout(m.checkouts[id]), nil
		}
	}
	if publicID != "" {
		if id, ok := m.byPublic[publicID]; ok {
			return cloneCheckout(m.checkouts[id]), nil
		}
	}
	return nil, nil
}

func (m *Mem) getUserByEmailLocked(email string) *db.User {
	id, ok := m.byEmail[strings.ToLower(email)]
	if !ok {
		return nil
	}
	return cloneUser(m.users[id])
}

func (m *Mem) FindUserByEmail(_ context.Context, email string) (*db.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.getUserByEmailLocked(email), nil
}

func (m *Mem) CreateGuestUser(_ context.Context, email, name string) (*db.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextUser
	m.nextUser++
	u := &db.User{ID: id, Email: email, DisplayName: name}
	m.users[id] = u
	m.byEmail[strings.ToLower(email)] = id
	return cloneUser(u), nil
}

func (m *Mem) CompleteCheckout(_ context.Context, checkoutID, userID int64) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	row := m.checkouts[checkoutID]
	if row == nil || row.Status != "pending" {
		return false, nil
	}
	row.Status = "completed"
	row.GuestUserID = int8(userID)
	row.CompletedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	return true, nil
}

func (m *Mem) SetPendingStatus(_ context.Context, checkoutID int64, status string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	row := m.checkouts[checkoutID]
	if row != nil && row.Status == "pending" {
		row.Status = status
	}
	return nil
}

func (m *Mem) InsertPayment(_ context.Context, checkoutID int64, paymentIntent string, amountCents int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextPay
	m.nextPay++
	m.payments = append(m.payments, &db.Payment{
		ID:                    id,
		CheckoutID:            checkoutID,
		StripePaymentIntentID: text(paymentIntent),
		AmountCents:           amountCents,
		Currency:              "usd",
	})
	return nil
}

func (m *Mem) MessageForCheckout(_ context.Context, checkoutID int64) (*db.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.msgByCheckout[checkoutID]
	if !ok {
		return nil, nil
	}
	cp := *m.messages[id]
	return &cp, nil
}

func (m *Mem) EnsureConversation(_ context.Context, userID int64) (*db.Conversation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id, ok := m.convoByGuest[userID]; ok {
		return cloneConvo(m.convos[id]), nil
	}
	id := m.nextConvo
	m.nextConvo++
	c := &db.Conversation{
		ID:             id,
		GuestUserID:    userID,
		LastActivityAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		CreatedAt:      pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	m.convos[id] = c
	m.convoByGuest[userID] = id
	return cloneConvo(c), nil
}

func (m *Mem) CreatePaidMessage(_ context.Context, conversationID, authorUserID, checkoutID int64, body string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.addMessage(conversationID, authorUserID, checkoutID, body)
	return nil
}

func (m *Mem) TouchConversation(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c := m.convos[id]; c != nil {
		c.LastActivityAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	}
	return nil
}

func (m *Mem) addMessage(conversationID, authorUserID, checkoutID int64, body string) *db.Message {
	id := m.nextMsg
	m.nextMsg++
	msg := &db.Message{
		ID:             id,
		ConversationID: conversationID,
		AuthorUserID:   authorUserID,
		Body:           body,
		CharacterCount: int32(utf8.RuneCountInString(body)),
		CreatedAt:      pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	if checkoutID > 0 {
		msg.CheckoutID = int8(checkoutID)
		m.msgByCheckout[checkoutID] = id
	}
	m.messages[id] = msg
	return msg
}

func (m *Mem) messagesFor(conversationID int64) []*db.Message {
	out := []*db.Message{}
	for _, msg := range m.messages {
		if msg.ConversationID == conversationID {
			cp := *msg
			out = append(out, &cp)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func cloneConvo(c *db.Conversation) *db.Conversation {
	if c == nil {
		return nil
	}
	cp := *c
	return &cp
}

func (m *Mem) PaymentCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.payments)
}

func (m *Mem) MessageCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.messages)
}

func (m *Mem) EventCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.events)
}

var errorsApplyFailed = errApplyFailed{}

type errApplyFailed struct{}

func (errApplyFailed) Error() string { return "apply_failed" }

var _ auth.Store = (*Mem)(nil)
var _ Repository = (*Mem)(nil)

func subscriptionSendable(s *db.Subscription) bool {
	if s == nil {
		return false
	}
	switch s.Status {
	case "active", "trialing", "past_due":
	default:
		return false
	}
	return s.CurrentPeriodEnd.Valid && s.CurrentPeriodEnd.Time.After(time.Now().UTC())
}

func (m *Mem) UpsertSubscription(_ context.Context, guestUserID int64, stripeSubID, customerID, status string, periodStart, periodEnd time.Time, charsUsed int32) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing := m.subs[stripeSubID]
	used := charsUsed
	if existing != nil && existing.CurrentPeriodStart.Valid && !existing.CurrentPeriodStart.Time.Equal(periodStart) {
		used = 0
	} else if existing != nil {
		used = existing.CharsUsed
		if existing.CurrentPeriodStart.Time.IsZero() {
			used = charsUsed
		}
	}
	if existing == nil {
		used = charsUsed
	}
	row := &db.Subscription{
		GuestUserID:          guestUserID,
		StripeSubscriptionID: stripeSubID,
		StripeCustomerID:     text(customerID),
		Status:               status,
		CurrentPeriodStart:   pgtype.Timestamptz{Time: periodStart.UTC(), Valid: true},
		CurrentPeriodEnd:     pgtype.Timestamptz{Time: periodEnd.UTC(), Valid: true},
		CharsUsed:            used,
	}
	if existing != nil {
		row.ID = existing.ID
	} else {
		row.ID = int64(len(m.subs) + 1)
	}
	m.subs[stripeSubID] = row
	return nil
}

func (m *Mem) GetSubscriptionByStripeID(_ context.Context, stripeSubID string) (*db.Subscription, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.subs[stripeSubID]
	if s == nil {
		return nil, nil
	}
	cp := *s
	return &cp, nil
}

func (m *Mem) AddGuestMessage(_ context.Context, userID int64, body string, allowance int32) (*db.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cid, ok := m.convoByGuest[userID]
	if !ok {
		return nil, ErrNotFound
	}
	c := m.convos[cid]
	if c.BlockedAt.Valid {
		return nil, ErrBlocked
	}
	var sub *db.Subscription
	for _, s := range m.subs {
		if s.GuestUserID == userID && subscriptionSendable(s) {
			sub = s
			break
		}
	}
	if sub == nil {
		return nil, ErrNoAllowance
	}
	n := int32(utf8.RuneCountInString(body))
	if sub.CharsUsed+n > allowance {
		return nil, ErrAllowanceExceeded
	}
	sub.CharsUsed += n
	msg := m.addMessage(c.ID, userID, 0, body)
	c.LastActivityAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	cp := *msg
	return &cp, nil
}

func (m *Mem) CreateRecoveryToken(_ context.Context, conversationID, guestUserID int64, tokenHash string, expiresAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextRecovery
	m.nextRecovery++
	m.recoveries[id] = &db.ChatRecoveryToken{
		ID:             id,
		ConversationID: conversationID,
		GuestUserID:    guestUserID,
		TokenHash:      tokenHash,
		ExpiresAt:      pgtype.Timestamptz{Time: expiresAt.UTC(), Valid: true},
	}
	return nil
}

func (m *Mem) LookupRecoveryToken(_ context.Context, tokenHash string) (*db.ChatRecoveryToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC()
	for _, row := range m.recoveries {
		if row.TokenHash == tokenHash && !row.ConsumedAt.Valid && row.ExpiresAt.Valid && row.ExpiresAt.Time.After(now) {
			cp := *row
			return &cp, nil
		}
	}
	return nil, nil
}

func (m *Mem) ConsumeRecoveryToken(_ context.Context, id int64) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	row := m.recoveries[id]
	if row == nil || row.ConsumedAt.Valid {
		return false, nil
	}
	row.ConsumedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	return true, nil
}

func (m *Mem) UpdateCreatorSettings(_ context.Context, in CreatorSettingsInput) (*db.Creator, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.creatorRow == nil {
		return nil, ErrNotFound
	}
	m.creatorRow.DisplayName = in.DisplayName
	m.creatorRow.Description = in.Description
	m.creatorRow.SupportItem = in.SupportItem
	m.creatorRow.OneTimePriceCents = in.OneTimePriceCents
	m.creatorRow.OneTimeCharacterLimit = limit250
	m.creatorRow.Price500Cents = in.Price500Cents
	m.creatorRow.Price1000Cents = in.Price1000Cents
	m.creatorRow.WeeklyPriceCents = in.WeeklyPriceCents
	cp := *m.creatorRow
	return &cp, nil
}

func (m *Mem) mediaForMessagesLocked(msgs []*db.Message) []*db.MediaObject {
	ids := map[int64]struct{}{}
	for _, msg := range msgs {
		ids[msg.ID] = struct{}{}
	}
	out := []*db.MediaObject{}
	for _, obj := range m.media {
		if obj.MessageID.Valid {
			if _, ok := ids[obj.MessageID.Int64]; ok {
				cp := *obj
				out = append(out, &cp)
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (m *Mem) unlocksForLocked(guestUserID int64) map[int64]bool {
	out := map[int64]bool{}
	for key := range m.unlocks {
		if key[1] == guestUserID {
			out[key[0]] = true
		}
	}
	return out
}

func (m *Mem) CreateUnlockCheckout(_ context.Context, email string, guestUserID, messageID, amountCents int64) (*db.Checkout, error) {
	row, err := m.CreateCheckout(context.Background(), "paid_content", email, "", amountCents, 0)
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	stored := m.checkouts[row.ID]
	stored.TargetMessageID = int8(messageID)
	stored.GuestUserID = int8(guestUserID)
	return cloneCheckout(stored), nil
}

func (m *Mem) InsertMediaObject(_ context.Context, obj *db.MediaObject) (*db.MediaObject, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id := m.nextMedia
	m.nextMedia++
	cp := *obj
	cp.ID = id
	cp.CreatedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	m.media[id] = &cp
	m.mediaByKey[cp.ObjectKey] = id
	out := cp
	return &out, nil
}

func (m *Mem) GetMediaObject(_ context.Context, id int64) (*db.MediaObject, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	obj := m.media[id]
	if obj == nil {
		return nil, nil
	}
	cp := *obj
	return &cp, nil
}

func (m *Mem) GetMediaObjectByKey(_ context.Context, key string) (*db.MediaObject, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.mediaByKey[key]
	if !ok {
		return nil, nil
	}
	cp := *m.media[id]
	return &cp, nil
}

func (m *Mem) DeleteUnattachedMedia(_ context.Context, id int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	obj := m.media[id]
	if obj == nil || obj.MessageID.Valid {
		return nil
	}
	delete(m.mediaByKey, obj.ObjectKey)
	delete(m.media, id)
	return nil
}

func (m *Mem) SetCreatorAvatarKey(_ context.Context, key string) (*db.Creator, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.creatorRow == nil {
		return nil, ErrNotFound
	}
	m.creatorRow.AvatarObjectKey = text(key)
	cp := *m.creatorRow
	return &cp, nil
}

func (m *Mem) GetMessage(_ context.Context, id int64) (*db.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	msg := m.messages[id]
	if msg == nil {
		return nil, nil
	}
	cp := *msg
	return &cp, nil
}

func (m *Mem) GuestHasUnlock(_ context.Context, messageID, guestUserID int64) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.unlocks[[2]int64{messageID, guestUserID}]
	return ok, nil
}

func (m *Mem) InsertUnlock(_ context.Context, messageID, guestUserID, checkoutID int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := [2]int64{messageID, guestUserID}
	if _, ok := m.unlocks[key]; ok {
		return nil
	}
	m.nextUnlock++
	m.unlocks[key] = checkoutID
	return nil
}
