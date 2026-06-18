package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

var mockLogs = logListResponse{
	Object: "list",
	Data: []logListItem{
		{ID: "log_001", Method: "POST", Endpoint: "/api/emails", ResponseStatus: 200, CreatedAt: "2025-05-01T10:00:00.000Z"},
		{ID: "log_002", Method: "GET", Endpoint: "/api/domains", ResponseStatus: 200, CreatedAt: "2025-05-01T09:55:00.000Z"},
	},
	HasMore: false,
}

// ── limit mode ────────────────────────────────────────────────────────────────

func TestLogsTailLimitHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/logs" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("unexpected Authorization: %s", r.Header.Get("Authorization"))
		}
		if r.URL.Query().Get("limit") == "" {
			t.Errorf("expected limit query param")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockLogs)
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origFollow, origLimit := logsFollow, logsLimit
	endpoint, apiKey = srv.URL, "test-key"
	logsFollow = false
	logsLimit = 20
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		logsFollow, logsLimit = origFollow, origLimit
	}()

	var out bytes.Buffer
	logsTailCmd.SetOut(&out)
	logsTailCmd.SetErr(&out)

	if err := runLogsTail(logsTailCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	for _, want := range []string{"POST", "/api/emails", "GET", "/api/domains", "200"} {
		if !strings.Contains(got, want) {
			t.Errorf("expected %q in output, got:\n%s", want, got)
		}
	}
}

func TestLogsTailNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	err := runLogsTail(logsTailCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestLogsTailHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid api key"}`))
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origFollow := logsFollow
	endpoint, apiKey = srv.URL, "bad-key"
	logsFollow = false
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		logsFollow = origFollow
	}()

	err := runLogsTail(logsTailCmd, nil)
	if err == nil {
		t.Fatal("expected error for 401")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("expected 401 in error, got: %v", err)
	}
}

// ── follow mode ───────────────────────────────────────────────────────────────

// TestFetchLogsFollowBehavior tests the deduplication logic used in follow mode
// without actually running the polling loop (which requires real-time waits).
func TestFetchLogsFollowBehavior(t *testing.T) {
	var callCount int32

	firstBatch := logListResponse{
		Object: "list",
		Data: []logListItem{
			{ID: "log_A", Method: "POST", Endpoint: "/api/emails", ResponseStatus: 200, CreatedAt: "2025-05-01T10:00:00Z"},
			{ID: "log_B", Method: "GET", Endpoint: "/api/domains", ResponseStatus: 200, CreatedAt: "2025-05-01T09:58:00Z"},
		},
	}
	secondBatch := logListResponse{
		Object: "list",
		Data: []logListItem{
			{ID: "log_C", Method: "DELETE", Endpoint: "/api/api-keys/123", ResponseStatus: 204, CreatedAt: "2025-05-01T10:02:00Z"},
			{ID: "log_A", Method: "POST", Endpoint: "/api/emails", ResponseStatus: 200, CreatedAt: "2025-05-01T10:00:00Z"}, // duplicate
		},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&callCount, 1)
		w.Header().Set("Content-Type", "application/json")
		if n == 1 {
			json.NewEncoder(w).Encode(firstBatch)
		} else {
			json.NewEncoder(w).Encode(secondBatch)
		}
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "test-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	// First fetch: should return 2 entries.
	entries1, err := fetchLogs(20)
	if err != nil {
		t.Fatalf("first fetch error: %v", err)
	}
	if len(entries1) != 2 {
		t.Errorf("expected 2 entries from first fetch, got %d", len(entries1))
	}

	// Simulate seen map used in follow mode.
	seen := make(map[string]bool)
	for _, e := range entries1 {
		seen[e.ID] = true
	}

	// Second fetch: 2 entries, 1 duplicate.
	entries2, err := fetchLogs(20)
	if err != nil {
		t.Fatalf("second fetch error: %v", err)
	}

	var newEntries []logListItem
	for _, e := range entries2 {
		if !seen[e.ID] {
			newEntries = append(newEntries, e)
			seen[e.ID] = true
		}
	}

	// Only log_C should be new.
	if len(newEntries) != 1 || newEntries[0].ID != "log_C" {
		t.Errorf("expected 1 new entry (log_C), got %v", newEntries)
	}

	if atomic.LoadInt32(&callCount) != 2 {
		t.Errorf("expected 2 server calls, got %d", atomic.LoadInt32(&callCount))
	}
}
