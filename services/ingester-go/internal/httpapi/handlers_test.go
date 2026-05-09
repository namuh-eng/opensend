package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	assertStatusEndpoint(t, "/health", StatusResponse{Status: "ok", Service: "ingester-go"})
}

func TestReadyzHandler(t *testing.T) {
	assertStatusEndpoint(t, "/readyz", StatusResponse{Status: "ready", Service: "ingester-go"})
}

func assertStatusEndpoint(t *testing.T, path string, expected StatusResponse) {
	t.Helper()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, path, nil)

	NewHandler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Fatalf("expected JSON content type, got %q", contentType)
	}

	var actual StatusResponse
	if err := json.NewDecoder(recorder.Body).Decode(&actual); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if actual != expected {
		t.Fatalf("expected response %#v, got %#v", expected, actual)
	}
}
