package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestSegmentsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/segments", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, SegmentResponse{Object: "segment", ID: "seg_001", Name: "VIP"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Segments.Create(context.Background(), CreateSegmentRequest{Name: "VIP"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "seg_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestSegmentsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/segments", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if r.URL.Query().Get("search") != "vip" {
			t.Errorf("search = %q, want vip", r.URL.Query().Get("search"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, SegmentListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []SegmentListItem{{ID: "seg_001", Name: "VIP"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Segments.List(context.Background(), SegmentListOptions{Search: "vip"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestSegmentsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/segments/seg_001", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, SegmentResponse{Object: "segment", ID: "seg_001", Name: "VIP"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Segments.Get(context.Background(), "seg_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.Name != "VIP" {
		t.Fatalf("name = %q", resp.Name)
	}
}

func TestSegmentsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/segments/seg_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteSegmentResponse{Success: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Segments.Delete(context.Background(), "seg_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Success {
		t.Fatal("success = false")
	}
}

func TestSegmentsListContacts(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/segments/seg_001/contacts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		email := "user@example.com"
		w.Write(mustJSON(t, SegmentContactListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []SegmentContactListItem{{ID: "con_001", Email: email}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Segments.ListContacts(context.Background(), "seg_001", ListOptions{})
	if err != nil {
		t.Fatalf("ListContacts: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}
