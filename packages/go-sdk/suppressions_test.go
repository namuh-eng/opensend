package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestSuppressionsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/suppressions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, SuppressionListResponse{
			Object:  "list",
			Scope:   "user",
			HasMore: false,
			Data:    []SuppressionPublicItem{{ID: "sup_001", Email: "bad@example.com", Reason: "bounce"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Suppressions.List(context.Background(), SuppressionListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestSuppressionsGet(t *testing.T) {
	mux := http.NewServeMux()
	// The email is URL-encoded: bad%40example.com
	mux.HandleFunc("/api/suppressions/bad%40example.com", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, SuppressionPublicItem{
			ID: "sup_001", Object: "suppression", Email: "bad@example.com", Reason: "bounce",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Suppressions.Get(context.Background(), "bad@example.com")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.Email != "bad@example.com" {
		t.Fatalf("email = %q", resp.Email)
	}
}

func TestSuppressionsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/suppressions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, SuppressionPublicItem{ID: "sup_001", Object: "suppression", Email: "bad@example.com", Reason: "manual"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Suppressions.Create(context.Background(), CreateSuppressionRequest{
		Email: "bad@example.com", Reason: "manual",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.Reason != "manual" {
		t.Fatalf("reason = %q", resp.Reason)
	}
}

func TestSuppressionsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/suppressions/bad%40example.com", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteSuppressionResponse{Object: "suppression", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Suppressions.Delete(context.Background(), "bad@example.com")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}
