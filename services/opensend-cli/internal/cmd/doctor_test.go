package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newDoctorServer creates an httptest server that simulates a healthy OpenSend instance.
// Pass healthStatus, apiKeyStatus, and domainCount to control each check's response.
func newDoctorServer(t *testing.T, healthStatus, apiKeyStatus int, domainCount int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/health":
			w.WriteHeader(healthStatus)
			w.Write([]byte(`{"status":"ok"}`))
		case "/api/api-keys":
			w.WriteHeader(apiKeyStatus)
			if apiKeyStatus == http.StatusOK {
				json.NewEncoder(w).Encode(apiKeyListResponse{Object: "list", Data: []apiKeyListItem{}})
			} else {
				w.Write([]byte(`{"error":"unauthorized"}`))
			}
		case "/api/domains":
			var doms []domain
			for i := 0; i < domainCount; i++ {
				doms = append(doms, domain{Name: "example.com", Status: "verified"})
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(doms)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

// ── all-pass scenario ─────────────────────────────────────────────────────────

func TestDoctorAllPass(t *testing.T) {
	srv := newDoctorServer(t, http.StatusOK, http.StatusOK, 2)
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "test-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	doctorCmd.SetOut(&out)

	err := runDoctor(doctorCmd, nil)
	if err != nil {
		t.Fatalf("expected no error for all-pass, got: %v", err)
	}

	got := out.String()
	if strings.Count(got, "[PASS]") != 3 {
		t.Errorf("expected 3 PASS lines, got:\n%s", got)
	}
	if strings.Contains(got, "[FAIL]") {
		t.Errorf("expected no FAIL lines, got:\n%s", got)
	}
}

// ── partial-pass: endpoint OK but bad key ─────────────────────────────────────

func TestDoctorPartialPass(t *testing.T) {
	srv := newDoctorServer(t, http.StatusOK, http.StatusUnauthorized, 0)
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "bad-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	doctorCmd.SetOut(&out)

	err := runDoctor(doctorCmd, nil)
	if err == nil {
		t.Fatal("expected error when auth fails")
	}

	got := out.String()
	if !strings.Contains(got, "[PASS]") {
		t.Errorf("expected at least one PASS (health), got:\n%s", got)
	}
	if !strings.Contains(got, "[FAIL]") {
		t.Errorf("expected FAIL for bad API key, got:\n%s", got)
	}
}

// ── full-fail: no endpoint ────────────────────────────────────────────────────

func TestDoctorFullFail(t *testing.T) {
	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint = "http://localhost:19999" // nothing listening here
	apiKey = "test-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	doctorCmd.SetOut(&out)

	err := runDoctor(doctorCmd, nil)
	if err == nil {
		t.Fatal("expected error when server unreachable")
	}

	got := out.String()
	if !strings.Contains(got, "[FAIL]") {
		t.Errorf("expected FAIL lines, got:\n%s", got)
	}
}

// ── no API key ────────────────────────────────────────────────────────────────

func TestDoctorNoAPIKey(t *testing.T) {
	srv := newDoctorServer(t, http.StatusOK, http.StatusOK, 1)
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, ""
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	doctorCmd.SetOut(&out)

	err := runDoctor(doctorCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key")
	}

	got := out.String()
	// Health should pass, auth should fail.
	if !strings.Contains(got, "[PASS]") {
		t.Errorf("expected PASS for health check, got:\n%s", got)
	}
	if !strings.Contains(got, "No API key") {
		t.Errorf("expected 'No API key' message, got:\n%s", got)
	}
}

// ── exit 0 with only warnings ─────────────────────────────────────────────────

func TestDoctorWarnOnly(t *testing.T) {
	// Server with health OK, auth OK, no domains.
	srv := newDoctorServer(t, http.StatusOK, http.StatusOK, 0)
	defer srv.Close()

	origEndpoint, origAPIKey := endpoint, apiKey
	endpoint, apiKey = srv.URL, "test-key"
	defer func() { endpoint, apiKey = origEndpoint, origAPIKey }()

	var out bytes.Buffer
	doctorCmd.SetOut(&out)

	// No domains → WARN, but no FAIL → err should be nil.
	err := runDoctor(doctorCmd, nil)
	if err != nil {
		t.Fatalf("expected nil error for warn-only scenario, got: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "[WARN]") {
		t.Errorf("expected at least one WARN (no domains), got:\n%s", got)
	}
	if strings.Contains(got, "[FAIL]") {
		t.Errorf("expected no FAIL lines for warn-only, got:\n%s", got)
	}
}
