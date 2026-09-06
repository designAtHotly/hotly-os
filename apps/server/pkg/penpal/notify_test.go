package penpal

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestCreatorPaidNoticeOnOneTimeAndWeekly(t *testing.T) {
	handler, fake, _, _, mail := testStack()
	sessionID := startPaidCheckout(t, handler, fake)
	wh := postWebhook(handler, `{"id":"evt_paid_mail","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if wh.Code != http.StatusOK {
		t.Fatalf("webhook %d %s", wh.Code, wh.Body.String())
	}
	msg := mail.Last()
	if msg == nil || msg.To != "creator@example.com" {
		t.Fatalf("expected creator notice, got %+v", msg)
	}
	if !strings.Contains(msg.Subject, "note") || !strings.Contains(msg.Text, "http://localhost/creator/inbox") {
		t.Fatalf("creator notice body %+v", msg)
	}
	if mail.Count() != 1 {
		t.Fatalf("one-time should send once, got %d", mail.Count())
	}
	postWebhook(handler, `{"id":"evt_paid_mail","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if mail.Count() != 1 {
		t.Fatalf("replay must not resend, got %d", mail.Count())
	}

	weekly := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":     "weekly@example.com",
		"message":   "Starting weekly.",
		"recurring": true,
	})
	if weekly.Code != http.StatusOK {
		t.Fatalf("weekly checkout %d %s", weekly.Code, weekly.Body.String())
	}
	now := int(time.Now().Unix())
	wh = postWebhook(handler, `{"id":"evt_weekly_mail","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":1500,"payment_status":"paid","subscription_id":"sub_mail","subscription_status":"active","period_start":`+strconv.Itoa(now)+`,"period_end":`+strconv.Itoa(now+7*24*3600)+`}`)
	if wh.Code != http.StatusOK {
		t.Fatalf("weekly webhook %d %s", wh.Code, wh.Body.String())
	}
	msg = mail.Last()
	if mail.Count() != 2 || msg == nil || !strings.Contains(msg.Subject, "weekly subscription") {
		t.Fatalf("weekly notice count=%d msg=%+v", mail.Count(), msg)
	}
}

func TestGuestReplyNoticeAndNoSubscriberFollowupEmail(t *testing.T) {
	handler, fake, mem, authSvc, mail := testStack()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_reply_mail","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if mail.Count() != 1 {
		t.Fatalf("paid notice %d", mail.Count())
	}
	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]any{
		"body": "Thanks for writing.",
	}, creator)
	if reply.Code != http.StatusOK {
		t.Fatalf("reply %d %s", reply.Code, reply.Body.String())
	}
	msg := mail.Last()
	if mail.Count() != 2 || msg == nil || msg.To != "guest@example.com" {
		t.Fatalf("guest reply notice count=%d msg=%+v", mail.Count(), msg)
	}
	if !strings.Contains(msg.Text, "http://localhost/chat") {
		t.Fatalf("chat link missing: %+v", msg)
	}

	weekly := doJSON(handler, http.MethodPost, "/penpal/checkout", map[string]any{
		"email":     "sub@example.com",
		"message":   "Weekly hello.",
		"recurring": true,
	})
	if weekly.Code != http.StatusOK {
		t.Fatalf("weekly %d", weekly.Code)
	}
	now := int(time.Now().Unix())
	postWebhook(handler, `{"id":"evt_sub_follow","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":1500,"payment_status":"paid","subscription_id":"sub_follow","subscription_status":"active","period_start":`+strconv.Itoa(now)+`,"period_end":`+strconv.Itoa(now+7*24*3600)+`}`)
	afterPaid := mail.Count()
	guest := claimCookie(t, handler, fake.LastID)
	follow := doJSON(handler, http.MethodPost, "/chat/messages", map[string]string{"body": "A follow-up in the allowance."}, guest)
	if follow.Code != http.StatusOK {
		t.Fatalf("follow-up %d %s", follow.Code, follow.Body.String())
	}
	if mail.Count() != afterPaid {
		t.Fatalf("subscriber follow-up must not email, before=%d after=%d", afterPaid, mail.Count())
	}
}

func TestPaidUnlockDoesNotEmailCreator(t *testing.T) {
	handler, fake, mem, authSvc, mail := testStack()
	sessionID := startPaidCheckout(t, handler, fake)
	postWebhook(handler, `{"id":"evt_unlock_mail_1","type":"checkout.session.completed","session_id":"`+sessionID+`","amount_cents":500,"payment_status":"paid"}`)
	if mail.Count() != 1 {
		t.Fatalf("paid notice %d", mail.Count())
	}
	creator := creatorSession(t, mem, authSvc)
	id := inboxConversationID(t, handler, creator)
	reply := doJSON(handler, http.MethodPost, "/creator/inbox/"+strconv.FormatInt(id, 10)+"/reply", map[string]any{
		"body":               "Paid photo.",
		"unlock_price_cents": 300,
	}, creator)
	if reply.Code != http.StatusOK {
		t.Fatalf("reply %d %s", reply.Code, reply.Body.String())
	}
	afterReply := mail.Count()
	guest := claimCookie(t, handler, sessionID)
	inboxThread := doJSON(handler, http.MethodGet, "/creator/inbox/"+strconv.FormatInt(id, 10), nil, creator)
	var body struct {
		Messages []struct {
			ID int64 `json:"id"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(inboxThread.Body.Bytes(), &body); err != nil || len(body.Messages) < 2 {
		t.Fatalf("thread %s", inboxThread.Body.String())
	}
	msgID := body.Messages[len(body.Messages)-1].ID
	unlock := doJSON(handler, http.MethodPost, "/chat/unlock", map[string]any{"message_id": msgID}, guest)
	if unlock.Code != http.StatusOK {
		t.Fatalf("unlock checkout %d %s", unlock.Code, unlock.Body.String())
	}
	wh := postWebhook(handler, `{"id":"evt_unlock_mail_2","type":"checkout.session.completed","session_id":"`+fake.LastID+`","amount_cents":300,"payment_status":"paid"}`)
	if wh.Code != http.StatusOK {
		t.Fatalf("unlock webhook %d %s", wh.Code, wh.Body.String())
	}
	if mail.Count() != afterReply {
		t.Fatalf("paid unlock must not email creator, before=%d after=%d last=%+v", afterReply, mail.Count(), mail.Last())
	}
}
