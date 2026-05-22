package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestContactsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/contacts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, CreateContactResponse{Object: "contact", ID: "con_001"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Contacts.Create(context.Background(), CreateContactRequest{Email: "user@example.com"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "con_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestContactsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/contacts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if got := r.URL.Query().Get("limit"); got != "10" {
			t.Errorf("limit = %q, want 10", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, ContactListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []ContactListItem{{ID: "con_001", Email: "user@example.com"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	limit := 10
	resp, err := client.Contacts.List(context.Background(), ListOptions{Limit: &limit})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestContactsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/contacts/con_001", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, ContactResponse{Object: "contact", ID: "con_001", Email: "user@example.com"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Contacts.Get(context.Background(), "con_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.Email != "user@example.com" {
		t.Fatalf("email = %q", resp.Email)
	}
}

func TestContactsUpdate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/contacts/con_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s", r.Method)
		}
		fn := "Alice"
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, ContactResponse{Object: "contact", ID: "con_001", FirstName: &fn}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Contacts.Update(context.Background(), "con_001", UpdateContactRequest{FirstName: "Alice"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if *resp.FirstName != "Alice" {
		t.Fatalf("first_name = %q", *resp.FirstName)
	}
}

func TestContactsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/contacts/con_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteContactResponse{Object: "contact", ID: "con_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Contacts.Delete(context.Background(), "con_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}
