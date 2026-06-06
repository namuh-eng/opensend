package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var mockDomains = []domain{
	{Name: "acme.com", Status: "verified", Region: "us-east-1", CreatedAt: "2025-01-15T10:00:00.000Z"},
	{Name: "beta.io", Status: "pending", Region: "eu-west-1", CreatedAt: "2025-03-20T08:30:00.000Z"},
}

func TestDomainsListHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/domains" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-key" {
			t.Errorf("unexpected Authorization: %s", auth)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockDomains)
	}))
	defer srv.Close()

	origEndpoint := endpoint
	origAPIKey := apiKey
	endpoint = srv.URL
	apiKey = "test-key"
	defer func() {
		endpoint = origEndpoint
		apiKey = origAPIKey
	}()

	var out bytes.Buffer
	domainsListCmd.SetOut(&out)
	domainsListCmd.SetErr(&out)

	err := runDomainsList(domainsListCmd, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "acme.com") {
		t.Errorf("expected 'acme.com' in output, got:\n%s", got)
	}
	if !strings.Contains(got, "beta.io") {
		t.Errorf("expected 'beta.io' in output, got:\n%s", got)
	}
	if !strings.Contains(got, "verified") {
		t.Errorf("expected 'verified' in output, got:\n%s", got)
	}
	if !strings.Contains(got, "NAME") {
		t.Errorf("expected header 'NAME' in output, got:\n%s", got)
	}
}

func TestDomainsListWrappedResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"data": mockDomains})
	}))
	defer srv.Close()

	origEndpoint := endpoint
	origAPIKey := apiKey
	endpoint = srv.URL
	apiKey = "test-key"
	defer func() {
		endpoint = origEndpoint
		apiKey = origAPIKey
	}()

	var out bytes.Buffer
	domainsListCmd.SetOut(&out)

	err := runDomainsList(domainsListCmd, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "acme.com") {
		t.Errorf("expected 'acme.com' in output, got:\n%s", got)
	}
}

func TestDomainsListNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	var out bytes.Buffer
	domainsListCmd.SetOut(&out)
	domainsListCmd.SetErr(&out)

	err := runDomainsList(domainsListCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key, got nil")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestDomainsListHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"invalid api key"}`))
	}))
	defer srv.Close()

	origEndpoint := endpoint
	origAPIKey := apiKey
	endpoint = srv.URL
	apiKey = "bad-key"
	defer func() {
		endpoint = origEndpoint
		apiKey = origAPIKey
	}()

	var out bytes.Buffer
	domainsListCmd.SetOut(&out)
	domainsListCmd.SetErr(&out)

	err := runDomainsList(domainsListCmd, nil)
	if err == nil {
		t.Fatal("expected error for 401, got nil")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("expected 401 in error, got: %v", err)
	}
}

func TestParseDomains(t *testing.T) {
	// Bare array.
	bare := `[{"name":"x.com","status":"verified"}]`
	domains, err := parseDomains([]byte(bare))
	if err != nil {
		t.Fatalf("bare array: %v", err)
	}
	if len(domains) != 1 || domains[0].Name != "x.com" {
		t.Errorf("unexpected result: %+v", domains)
	}

	// Wrapped.
	wrapped := `{"data":[{"name":"y.com","status":"pending"}]}`
	domains, err = parseDomains([]byte(wrapped))
	if err != nil {
		t.Fatalf("wrapped: %v", err)
	}
	if len(domains) != 1 || domains[0].Name != "y.com" {
		t.Errorf("unexpected result: %+v", domains)
	}
}

func TestFormatCreated(t *testing.T) {
	cases := []struct{ input, want string }{
		{"2025-01-15T10:00:00.000Z", "2025-01-15T10:00:00Z"},
		{"2025-01-15T10:00:00Z", "2025-01-15T10:00:00Z"},
		{"", "-"},
	}
	for _, c := range cases {
		got := formatCreated(c.input)
		if got != c.want {
			t.Errorf("formatCreated(%q) = %q, want %q", c.input, got, c.want)
		}
	}
}
