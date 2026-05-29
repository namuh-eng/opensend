package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var mockAPIKeys = apiKeyListResponse{
	Object: "list",
	Data: []apiKeyListItem{
		{ID: "key_abc123", Name: "Production", Permission: "full_access", CreatedAt: "2025-01-15T10:00:00.000Z", LastUsedAt: "2026-05-28T14:22:00.000Z"},
		{ID: "key_def456", Name: "Read Only", Permission: "read_only", CreatedAt: "2025-03-20T08:30:00.000Z"},
	},
	HasMore: false,
}

// ── list ──────────────────────────────────────────────────────────────────────

func TestAPIKeysListHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/api-keys" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodGet {
			t.Errorf("unexpected method: %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("unexpected Authorization: %s", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockAPIKeys)
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "test-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	apiKeysListCmd.SetOut(&out)
	apiKeysListCmd.SetErr(&out)

	if err := runApiKeysList(apiKeysListCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	for _, want := range []string{"key_abc123", "Production", "full_access", "key_def456", "Read Only", "ID", "NAME", "LAST USED"} {
		if !strings.Contains(got, want) {
			t.Errorf("expected %q in output, got:\n%s", want, got)
		}
	}
}

func TestAPIKeysListNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	err := runApiKeysList(apiKeysListCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestAPIKeysListHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid api key"}`))
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "bad-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	err := runApiKeysList(apiKeysListCmd, nil)
	if err == nil {
		t.Fatal("expected error for 401")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("expected 401 in error, got: %v", err)
	}
}

// ── create ────────────────────────────────────────────────────────────────────

func TestAPIKeysCreateHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/api-keys" || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(apiKeyCreateResponse{ID: "key_new001", Token: "os_live_abc123secret"})
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origName, origPerm := apiKeyCreateName, apiKeyCreatePermission
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyCreateName = "My New Key"
	apiKeyCreatePermission = "full_access"
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		apiKeyCreateName, apiKeyCreatePermission = origName, origPerm
	}()

	var out bytes.Buffer
	apiKeysCreateCmd.SetOut(&out)

	if err := runApiKeysCreate(apiKeysCreateCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "os_live_abc123secret") {
		t.Errorf("expected token in output, got:\n%s", got)
	}
	if !strings.Contains(got, "WARNING") {
		t.Errorf("expected WARNING in output, got:\n%s", got)
	}
	if !strings.Contains(got, "only ONCE") {
		t.Errorf("expected 'only ONCE' warning in output, got:\n%s", got)
	}
}

func TestAPIKeysCreateMissingName(t *testing.T) {
	origAPIKey := apiKey
	origName := apiKeyCreateName
	apiKey = "test-key"
	apiKeyCreateName = ""
	defer func() {
		apiKey = origAPIKey
		apiKeyCreateName = origName
	}()

	err := runApiKeysCreate(apiKeysCreateCmd, nil)
	if err == nil {
		t.Fatal("expected error when name missing")
	}
	if !strings.Contains(err.Error(), "--name is required") {
		t.Errorf("expected '--name is required' in error, got: %v", err)
	}
}

func TestAPIKeysCreateNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	err := runApiKeysCreate(apiKeysCreateCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestAPIKeysCreateHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error":"quota exceeded"}`))
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origName := apiKeyCreateName
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyCreateName = "Test"
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		apiKeyCreateName = origName
	}()

	err := runApiKeysCreate(apiKeysCreateCmd, nil)
	if err == nil {
		t.Fatal("expected error for 403")
	}
	if !strings.Contains(err.Error(), "403") {
		t.Errorf("expected 403 in error, got: %v", err)
	}
}

// ── revoke ────────────────────────────────────────────────────────────────────

func TestAPIKeysRevokeHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/api-keys/key_abc123" || r.Method != http.MethodDelete {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origYes := apiKeyRevokeYes
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyRevokeYes = true
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		apiKeyRevokeYes = origYes
	}()

	var out bytes.Buffer
	apiKeysRevokeCmd.SetOut(&out)

	if err := runApiKeysRevoke(apiKeysRevokeCmd, []string{"key_abc123"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "revoked") {
		t.Errorf("expected 'revoked' in output, got:\n%s", got)
	}
}

func TestAPIKeysRevokeNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	err := runApiKeysRevoke(apiKeysRevokeCmd, []string{"key_abc123"})
	if err == nil {
		t.Fatal("expected error when no API key")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestAPIKeysRevokeStdinPromptYes(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	origEndpoint, origAPIKey, origYes := endpoint, apiKey, apiKeyRevokeYes
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyRevokeYes = false
	defer func() {
		endpoint, apiKey, apiKeyRevokeYes = origEndpoint, origAPIKey, origYes
	}()

	var out bytes.Buffer
	apiKeysRevokeCmd.SetOut(&out)
	apiKeysRevokeCmd.SetIn(strings.NewReader("y\n"))
	defer apiKeysRevokeCmd.SetIn(nil)

	if err := runApiKeysRevoke(apiKeysRevokeCmd, []string{"key_abc123"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "Revoke API key key_abc123?") {
		t.Errorf("expected confirmation prompt in output, got:\n%s", got)
	}
	if !strings.Contains(got, "revoked") {
		t.Errorf("expected 'revoked' in output after 'y', got:\n%s", got)
	}
}

func TestAPIKeysRevokeStdinPromptNoAborts(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	origEndpoint, origAPIKey, origYes := endpoint, apiKey, apiKeyRevokeYes
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyRevokeYes = false
	defer func() {
		endpoint, apiKey, apiKeyRevokeYes = origEndpoint, origAPIKey, origYes
	}()

	var out bytes.Buffer
	apiKeysRevokeCmd.SetOut(&out)
	apiKeysRevokeCmd.SetIn(strings.NewReader("n\n"))
	defer apiKeysRevokeCmd.SetIn(nil)

	if err := runApiKeysRevoke(apiKeysRevokeCmd, []string{"key_abc123"}); err != nil {
		t.Fatalf("unexpected error when aborting: %v", err)
	}

	if hit {
		t.Error("expected DELETE not to be called when user answered 'n'")
	}
	if !strings.Contains(out.String(), "Aborted") {
		t.Errorf("expected 'Aborted' in output, got:\n%s", out.String())
	}
}

func TestAPIKeysRevokeHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"key not found"}`))
	}))
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	origYes := apiKeyRevokeYes
	endpoint, apiKey = srv.URL, "test-key"
	apiKeyRevokeYes = true
	defer func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		apiKeyRevokeYes = origYes
	}()

	err := runApiKeysRevoke(apiKeysRevokeCmd, []string{"key_notexist"})
	if err == nil {
		t.Fatal("expected error for 404")
	}
	if !strings.Contains(err.Error(), "404") {
		t.Errorf("expected 404 in error, got: %v", err)
	}
}
