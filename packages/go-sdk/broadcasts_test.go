package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestBroadcastsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/broadcasts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		if got := r.Header.Get("Idempotency-Key"); got != "bcast-idem" {
			t.Errorf("Idempotency-Key = %q, want bcast-idem", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, CreateBroadcastResponse{
			Object: "broadcast", ID: "bc_001", Name: "Newsletter", Status: "draft",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Broadcasts.Create(context.Background(), CreateBroadcastRequest{
		From: "news@example.com", Subject: "Newsletter Q1", Name: "Newsletter",
	}, RequestOptions{IdempotencyKey: "bcast-idem"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "bc_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestBroadcastsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/broadcasts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if r.URL.Query().Get("status") != "sent" {
			t.Errorf("status = %q, want sent", r.URL.Query().Get("status"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, BroadcastListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []BroadcastListItem{{ID: "bc_001", Name: "Newsletter", Status: "sent"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Broadcasts.List(context.Background(), BroadcastListOptions{Status: "sent"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestBroadcastsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/broadcasts/bc_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		name := "Newsletter"
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, BroadcastResponse{
			BroadcastListItem: BroadcastListItem{ID: "bc_001", Name: name},
			Object:            "broadcast",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Broadcasts.Get(context.Background(), "bc_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "bc_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestBroadcastsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/broadcasts/bc_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteBroadcastResponse{Object: "broadcast", ID: "bc_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Broadcasts.Delete(context.Background(), "bc_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}

func TestBroadcastsSend(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/broadcasts/bc_001/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, SendBroadcastResponse{Object: "broadcast", ID: "bc_001", Status: "queued"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Broadcasts.Send(context.Background(), "bc_001", SendBroadcastRequest{})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if resp.Status != "queued" {
		t.Fatalf("status = %q", resp.Status)
	}
}
