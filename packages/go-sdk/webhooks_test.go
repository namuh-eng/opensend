package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestWebhooksCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, WebhookCreateResponse{
			WebhookListItem: WebhookListItem{
				ID:       "wh_001",
				Endpoint: "https://example.com/hook",
				Events:   []string{"email.sent"},
				Status:   "enabled",
			},
			Object:        "webhook",
			SigningSecret: "whsec_abc123",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.Create(context.Background(), CreateWebhookRequest{
		Endpoint: "https://example.com/hook",
		Events:   []string{"email.sent"},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "wh_001" {
		t.Fatalf("id = %q", resp.ID)
	}
	if resp.SigningSecret != "whsec_abc123" {
		t.Fatalf("signing_secret = %q", resp.SigningSecret)
	}
}

func TestWebhooksList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, WebhookListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []WebhookListItem{{ID: "wh_001", Endpoint: "https://example.com/hook"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.List(context.Background(), WebhookListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestWebhooksGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks/wh_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, WebhookDetailResponse{
			WebhookListItem: WebhookListItem{ID: "wh_001", Endpoint: "https://example.com/hook"},
			Object:          "webhook",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.Get(context.Background(), "wh_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "wh_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestWebhooksUpdate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks/wh_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, WebhookUpdateResponse{
			WebhookListItem: WebhookListItem{ID: "wh_001", Status: "disabled"},
			Object:          "webhook",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.Update(context.Background(), "wh_001", UpdateWebhookRequest{Status: "disabled"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if resp.Status != "disabled" {
		t.Fatalf("status = %q", resp.Status)
	}
}

func TestWebhooksDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks/wh_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteWebhookResponse{Object: "webhook", ID: "wh_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.Delete(context.Background(), "wh_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}

func TestWebhooksListDeliveries(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks/wh_001/deliveries", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		code := 200
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, WebhookDeliveryListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []WebhookDeliveryItem{{ID: "del_001", Status: "delivered", StatusCode: &code}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.ListDeliveries(context.Background(), "wh_001", ListOptions{})
	if err != nil {
		t.Fatalf("ListDeliveries: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestWebhooksReplayDelivery(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/webhooks/wh_001/deliveries/del_001/replay", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, WebhookDeliveryReplayResponse{
			Object:           "webhook_delivery_replay",
			OriginalDelivery: WebhookDeliveryItem{ID: "del_001"},
			ReplayDelivery:   WebhookDeliveryItem{ID: "del_002"},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Webhooks.ReplayDelivery(context.Background(), "wh_001", "del_001")
	if err != nil {
		t.Fatalf("ReplayDelivery: %v", err)
	}
	if resp.ReplayDelivery.ID != "del_002" {
		t.Fatalf("replay id = %q", resp.ReplayDelivery.ID)
	}
}
