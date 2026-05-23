package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestTopicsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/topics", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, CreateTopicResponse{
			Object:              "topic",
			ID:                  "top_001",
			Name:                "Product updates",
			DefaultSubscription: "opt_in",
			Visibility:          "public",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Topics.Create(context.Background(), CreateTopicRequest{
		Name:                "Product updates",
		DefaultSubscription: "opt_in",
		Visibility:          "public",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "top_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestTopicsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/topics", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TopicListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []TopicListItem{{ID: "top_001", Name: "Product updates"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Topics.List(context.Background(), TopicListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestTopicsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/topics/top_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TopicResponse{Object: "topic", ID: "top_001", Name: "Product updates"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Topics.Get(context.Background(), "top_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.Name != "Product updates" {
		t.Fatalf("name = %q", resp.Name)
	}
}

func TestTopicsUpdate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/topics/top_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, TopicResponse{Object: "topic", ID: "top_001", Name: "Product news"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Topics.Update(context.Background(), "top_001", UpdateTopicRequest{Name: "Product news"})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if resp.Name != "Product news" {
		t.Fatalf("name = %q", resp.Name)
	}
}

func TestTopicsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/topics/top_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, DeleteTopicResponse{Success: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Topics.Delete(context.Background(), "top_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Success {
		t.Fatal("success = false")
	}
}
