package opensend

// Tests for: audiences, templates, events, logs, apikeys

import (
	"context"
	"net/http"
	"testing"
)

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

func TestAudiencesCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/audiences", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, AudienceResponse{Object: "audience", ID: "aud_001", Name: "Newsletter subscribers"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Audiences.Create(context.Background(), CreateAudienceRequest{Name: "Newsletter subscribers"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "aud_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestAudiencesList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/audiences", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AudienceListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []AudienceListItem{{ID: "aud_001", Name: "Newsletter subscribers"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Audiences.List(context.Background(), AudienceListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestAudiencesDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/audiences/aud_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteAudienceResponse{Object: "audience", ID: "aud_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Audiences.Delete(context.Background(), "aud_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

func TestTemplatesCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/templates", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, TemplateIDResponse{Object: "template", ID: "tpl_001"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Templates.Create(context.Background(), CreateTemplateRequest{Name: "Welcome"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "tpl_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestTemplatesList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/templates", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TemplateListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []TemplateListItem{{Object: "template", ID: "tpl_001", Name: "Welcome", Status: "draft"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Templates.List(context.Background(), TemplateListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestTemplatesPublish(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/templates/tpl_001/publish", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TemplateIDResponse{Object: "template", ID: "tpl_001"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Templates.Publish(context.Background(), "tpl_001")
	if err != nil {
		t.Fatalf("Publish: %v", err)
	}
	if resp.ID != "tpl_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestTemplatesDuplicate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/templates/tpl_001/duplicate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TemplateIDResponse{Object: "template", ID: "tpl_002"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Templates.Duplicate(context.Background(), "tpl_001")
	if err != nil {
		t.Fatalf("Duplicate: %v", err)
	}
	if resp.ID != "tpl_002" {
		t.Fatalf("id = %q, want tpl_002", resp.ID)
	}
}

func TestTemplatesDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/templates/tpl_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteTemplateResponse{Object: "template", ID: "tpl_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Templates.Delete(context.Background(), "tpl_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

func TestEventsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, CustomEvent{Object: "event", ID: "evt_001", Name: "user.signed_up"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Events.Create(context.Background(), CreateEventRequest{Name: "user.signed_up"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.Name != "user.signed_up" {
		t.Fatalf("name = %q", resp.Name)
	}
}

func TestEventsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, CustomEventListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []CustomEvent{{Object: "event", ID: "evt_001", Name: "user.signed_up"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Events.List(context.Background(), ListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestEventsSend(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/events/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		email := "user@example.com"
		w.Write(mustJSON(t, SendCustomEventResponse{
			Object: "event_delivery",
			Delivery: CustomEventDelivery{
				Object: "event_delivery",
				ID:     "evtdel_001",
				Event:  "user.signed_up",
				Email:  &email,
			},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Events.Send(context.Background(), SendEventRequest{
		Event: "user.signed_up",
		Email: "user@example.com",
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.Delivery.ID != "evtdel_001" {
		t.Fatalf("delivery id = %q", resp.Delivery.ID)
	}
}

// ---------------------------------------------------------------------------
// API Keys
// ---------------------------------------------------------------------------

func TestAPIKeysCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api-keys", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, APIKeyResponse{ID: "key_001", Token: "os_live_abc123"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.APIKeys.Create(context.Background(), CreateAPIKeyRequest{Name: "My key"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.Token != "os_live_abc123" {
		t.Fatalf("token = %q", resp.Token)
	}
}

func TestAPIKeysList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api-keys", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, APIKeyListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []APIKeyListItem{{ID: "key_001", Name: "My key"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.APIKeys.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestAPIKeysDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api-keys/key_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	})

	client, _ := newTestClient(t, mux)
	if err := client.APIKeys.Delete(context.Background(), "key_001"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

func TestLogsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/logs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if r.URL.Query().Get("method") != "POST" {
			t.Errorf("method param = %q, want POST", r.URL.Query().Get("method"))
		}
		method := "POST"
		endpoint := "/emails"
		status := 200
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, LogListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []LogListItem{{ID: "log_001", Method: &method, Endpoint: &endpoint, ResponseStatus: &status}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Logs.List(context.Background(), LogListOptions{Method: "POST"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestLogsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/logs/log_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		method := "POST"
		status := 200
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, LogDetailResponse{
			Object: "log", ID: "log_001", Method: &method, Status: &status,
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Logs.Get(context.Background(), "log_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "log_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}
