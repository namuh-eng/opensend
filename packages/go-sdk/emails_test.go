package opensend

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestClient(t *testing.T, mux *http.ServeMux) (*Client, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	client, err := NewClient("os_test_key", WithBaseURL(srv.URL), WithHTTPClient(srv.Client()))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return client, srv
}

func mustJSON(t *testing.T, v interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}
	return b
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

func TestEmailsSend(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer os_test_key" {
			t.Errorf("auth = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(mustJSON(t, EmailResponse{ID: "email_001"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Emails.Send(context.Background(), SendEmailRequest{
		From:    "sender@example.com",
		To:      []string{"recipient@example.com"},
		Subject: "Hello",
		HTML:    "<p>Test</p>",
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.ID != "email_001" {
		t.Fatalf("id = %q, want email_001", resp.ID)
	}
}

func TestEmailsSendWithIdempotencyKey(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails", func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Idempotency-Key"); got != "idem-key-abc" {
			t.Errorf("Idempotency-Key = %q, want idem-key-abc", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, EmailResponse{ID: "email_idem"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Emails.Send(context.Background(), SendEmailRequest{
		From: "a@a.com", To: []string{"b@b.com"}, Subject: "S",
	}, RequestOptions{IdempotencyKey: "idem-key-abc"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.ID != "email_idem" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestEmailsSendBatch(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails/batch", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		var body []map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode: %v", err)
		}
		if len(body) != 2 {
			t.Errorf("batch size = %d, want 2", len(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, BatchEmailResponse{
			Data: []BatchEmailItemResponse{{ID: "e1"}, {ID: "e2"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Emails.SendBatch(context.Background(), []SendEmailRequest{
		{From: "a@a.com", To: []string{"b@b.com"}, Subject: "1"},
		{From: "a@a.com", To: []string{"c@c.com"}, Subject: "2"},
	})
	if err != nil {
		t.Fatalf("SendBatch: %v", err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("data length = %d", len(resp.Data))
	}
}

func TestEmailsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/emails", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("limit") != "5" {
			t.Errorf("limit = %q, want 5", r.URL.Query().Get("limit"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, EmailListResponse{
			Object: "list", HasMore: false,
			Data: []EmailListItem{{ID: "email_list_1"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	limit := 5
	resp, err := client.Emails.List(context.Background(), EmailListOptions{Limit: &limit})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 || resp.Data[0].ID != "email_list_1" {
		t.Fatalf("unexpected data: %+v", resp.Data)
	}
}

func TestEmailsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/emails/email_xyz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		html := "<p>Hi</p>"
		w.Write(mustJSON(t, EmailDetailResponse{
			EmailListItem: EmailListItem{ID: "email_xyz"},
			Object:        "email",
			HTML:          &html,
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Emails.Get(context.Background(), "email_xyz")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "email_xyz" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestEmailsCancel(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails/email_cancel/cancel", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, CancelEmailResponse{Object: "email", ID: "email_cancel"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Emails.Cancel(context.Background(), "email_cancel")
	if err != nil {
		t.Fatalf("Cancel: %v", err)
	}
	if resp.ID != "email_cancel" {
		t.Fatalf("id = %q", resp.ID)
	}
}

// Backward-compat: client.Send still works
func TestClientSendBackwardCompat(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, EmailResponse{ID: "compat_id"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Send(context.Background(), SendRequest{
		From: "a@a.com", To: []string{"b@b.com"}, Subject: "Test",
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.ID != "compat_id" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestEmailsAPIError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/emails", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		w.Write([]byte(`{"name":"validation_error","code":"validation_error","message":"'from' is required"}`))
	})

	client, _ := newTestClient(t, mux)
	_, err := client.Emails.Send(context.Background(), SendEmailRequest{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("error type = %T, want *APIError", err)
	}
	if apiErr.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", apiErr.StatusCode)
	}
	if apiErr.Name != "validation_error" {
		t.Fatalf("name = %q", apiErr.Name)
	}
}
