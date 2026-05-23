package opensend

import (
	"context"
	"net/http"
	"testing"
)

func TestAutomationsCreate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		w.Write(mustJSON(t, AutomationDetailResponse{
			Object: "automation",
			ID:     "auto_001",
			Name:   "Welcome flow",
			Status: "draft",
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.Create(context.Background(), CreateAutomationRequest{
		Name:  "Welcome flow",
		Steps: []AutomationStepPayload{{Key: "trigger", Type: "trigger"}},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.ID != "auto_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestAutomationsList(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []AutomationListItem{{Object: "automation", ID: "auto_001", Name: "Welcome flow"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.List(context.Background(), AutomationListOptions{})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestAutomationsGet(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationDetailResponse{Object: "automation", ID: "auto_001", Name: "Welcome flow"}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.Get(context.Background(), "auto_001")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if resp.ID != "auto_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestAutomationsDelete(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationDeleteResponse{Object: "automation", ID: "auto_001", Deleted: true}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.Delete(context.Background(), "auto_001")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !resp.Deleted {
		t.Fatal("deleted = false")
	}
}

func TestAutomationsListRuns(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001/runs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if r.URL.Query().Get("status") != "completed" {
			t.Errorf("status = %q, want completed", r.URL.Query().Get("status"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationRunListResponse{
			Object:  "list",
			HasMore: false,
			Data:    []AutomationRunListItem{{Object: "automation_run", ID: "run_001", AutomationID: "auto_001"}},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.ListRuns(context.Background(), "auto_001", AutomationRunListOptions{Status: "completed"})
	if err != nil {
		t.Fatalf("ListRuns: %v", err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("len = %d", len(resp.Data))
	}
}

func TestAutomationsGetRun(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001/runs/run_001", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationRunDetailItem{
			AutomationRunListItem: AutomationRunListItem{
				Object: "automation_run", ID: "run_001", AutomationID: "auto_001",
			},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.GetRun(context.Background(), "auto_001", "run_001")
	if err != nil {
		t.Fatalf("GetRun: %v", err)
	}
	if resp.ID != "run_001" {
		t.Fatalf("id = %q", resp.ID)
	}
}

func TestAutomationsCancelRun(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001/runs/run_001/cancel", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		status := "cancelled"
		w.Write(mustJSON(t, AutomationRunDetailItem{
			AutomationRunListItem: AutomationRunListItem{
				Object: "automation_run", ID: "run_001", Status: status,
			},
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.CancelRun(context.Background(), "auto_001", "run_001", CancelAutomationRunRequest{Reason: "test"})
	if err != nil {
		t.Fatalf("CancelRun: %v", err)
	}
	if resp.Status != "cancelled" {
		t.Fatalf("status = %q", resp.Status)
	}
}

func TestAutomationsGetRunMetrics(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/automations/auto_001/runs/metrics", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %s", r.Method)
		}
		if r.URL.Query().Get("from") != "2024-01-01" {
			t.Errorf("from = %q, want 2024-01-01", r.URL.Query().Get("from"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(mustJSON(t, AutomationRunMetricsResponse{
			Object:       "automation_run_metrics",
			AutomationID: "auto_001",
			TotalRuns:    42,
		}))
	})

	client, _ := newTestClient(t, mux)
	resp, err := client.Automations.GetRunMetrics(context.Background(), "auto_001", AutomationRunMetricsOptions{From: "2024-01-01"})
	if err != nil {
		t.Fatalf("GetRunMetrics: %v", err)
	}
	if resp.TotalRuns != 42 {
		t.Fatalf("total_runs = %d", resp.TotalRuns)
	}
}
