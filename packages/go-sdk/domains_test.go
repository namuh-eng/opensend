package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestDomainsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, DomainResponse{
			Object: "domain",
			ID:     "dom_001",
			Name:   "mail.example.com",
			Status: "pending",
			Region: "us-east-1",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Domains.Create(context.Background(), CreateDomainRequest{Name: "mail.example.com"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "dom_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestDomainsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DomainListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []DomainListItem{{ID: "dom_001", Name: "mail.example.com"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Domains.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestDomainsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains/dom_001", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DomainResponse{Object: "domain", ID: "dom_001", Name: "mail.example.com"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Domains.Get(context.Background(), "dom_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "dom_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestDomainsUpdate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains/dom_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DomainUpdateResponse{Object: "domain", ID: "dom_001"}))
	})

	client, _ := newTestClient(t, mux)
	enabled := true
	resp, err := client.Domains.Update(context.Background(), "dom_001", UpdateDomainRequest{OpenTracking: &enabled})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if resp.ID != "dom_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestDomainsVerify(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains/dom_001/verify", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DomainResponse{Object: "domain", ID: "dom_001", Status: "verified"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Domains.Verify(context.Background(), "dom_001")
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if resp.Status != "verified" {
		t.Fatalf("status = %q", resp.Status)
	}
}

func TestDomainsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/domains/dom_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteDomainResponse{Object: "domain", ID: "dom_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Domains.Delete(context.Background(), "dom_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}
