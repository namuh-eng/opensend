package cmd

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/health" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}))
	defer srv.Close()

	// Override the global endpoint used by the command.
	origEndpoint := endpoint
	endpoint = srv.URL
	defer func() { endpoint = origEndpoint }()

	var out bytes.Buffer
	healthCmd.SetOut(&out)
	healthCmd.SetErr(&out)

	err := runHealth(healthCmd, nil)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "ok") {
		t.Errorf("expected 'ok' in output, got: %q", got)
	}
}

func TestHealthUnhealthy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"degraded","message":"database unreachable"}`))
	}))
	defer srv.Close()

	origEndpoint := endpoint
	endpoint = srv.URL
	defer func() { endpoint = origEndpoint }()

	var out bytes.Buffer
	healthCmd.SetOut(&out)
	healthCmd.SetErr(&out)

	err := runHealth(healthCmd, nil)
	if err == nil {
		t.Fatal("expected error for 503, got nil")
	}
	if !strings.Contains(err.Error(), "503") {
		t.Errorf("expected 503 in error message, got: %v", err)
	}
}

func TestHealthConnectionRefused(t *testing.T) {
	origEndpoint := endpoint
	endpoint = "http://127.0.0.1:19999" // nothing listening
	defer func() { endpoint = origEndpoint }()

	var out bytes.Buffer
	healthCmd.SetOut(&out)
	healthCmd.SetErr(&out)

	err := runHealth(healthCmd, nil)
	if err == nil {
		t.Fatal("expected connection error, got nil")
	}
}

func TestOneliner(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{`{"status":"ok"}`, "ok"},
		{`{"message":"all good"}`, "all good"},
		{`{"error":"boom"}`, "boom"},
		{`plain text`, "plain text"},
		{``, ""},
	}
	for _, c := range cases {
		got := oneliner([]byte(c.input))
		if got != c.want {
			t.Errorf("oneliner(%q) = %q, want %q", c.input, got, c.want)
		}
	}
}
