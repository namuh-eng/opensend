package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupSendTest(t *testing.T, srv *httptest.Server) func() {
	t.Helper()
	origEndpoint, origAPIKey := endpoint, apiKey
	origFrom, origTo, origSubject := sendFrom, sendTo, sendSubject
	origText, origHTML := sendText, sendHTML
	origReplyTo := sendReplyTo
	origTextFile, origHTMLFile := sendTextFile, sendHTMLFile

	endpoint = srv.URL
	apiKey = "test-key"
	sendFrom = "from@example.com"
	sendTo = "to@example.com"
	sendSubject = "Hello"
	sendText = ""
	sendHTML = ""
	sendReplyTo = ""
	sendTextFile = ""
	sendHTMLFile = ""

	return func() {
		endpoint, apiKey = origEndpoint, origAPIKey
		sendFrom, sendTo, sendSubject = origFrom, origTo, origSubject
		sendText, sendHTML = origText, origHTML
		sendReplyTo = origReplyTo
		sendTextFile, sendHTMLFile = origTextFile, origHTMLFile
	}
}

func TestSendTextOnly(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/emails" || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		var body sendEmailRequest
		json.NewDecoder(r.Body).Decode(&body)
		if body.Text == "" {
			t.Errorf("expected text body in request")
		}
		if body.HTML != "" {
			t.Errorf("expected no html body, got %q", body.HTML)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sendEmailResponse{ID: "email_text001"})
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendText = "Hello plain text"

	var out bytes.Buffer
	sendCmd.SetOut(&out)
	if err := runSend(sendCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out.String(), "email_text001") {
		t.Errorf("expected email ID in output, got: %s", out.String())
	}
}

func TestSendHTMLOnly(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body sendEmailRequest
		json.NewDecoder(r.Body).Decode(&body)
		if body.HTML == "" {
			t.Errorf("expected html body in request")
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sendEmailResponse{ID: "email_html002"})
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendHTML = "<h1>Hello</h1>"

	var out bytes.Buffer
	sendCmd.SetOut(&out)
	if err := runSend(sendCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out.String(), "email_html002") {
		t.Errorf("expected email ID in output, got: %s", out.String())
	}
}

func TestSendBothTextAndHTML(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body sendEmailRequest
		json.NewDecoder(r.Body).Decode(&body)
		if body.Text == "" || body.HTML == "" {
			t.Errorf("expected both text and html, got text=%q html=%q", body.Text, body.HTML)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sendEmailResponse{ID: "email_both003"})
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendText = "plain"
	sendHTML = "<p>html</p>"

	var out bytes.Buffer
	sendCmd.SetOut(&out)
	if err := runSend(sendCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out.String(), "email_both003") {
		t.Errorf("expected email ID in output, got: %s", out.String())
	}
}

func TestSendMissingBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("server should not be called when body is missing")
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	// No text, html, text-file, or html-file set.

	err := runSend(sendCmd, nil)
	if err == nil {
		t.Fatal("expected error when body missing")
	}
	if !strings.Contains(err.Error(), "required") {
		t.Errorf("expected 'required' in error, got: %v", err)
	}
}

func TestSendTextFile(t *testing.T) {
	dir := t.TempDir()
	fpath := filepath.Join(dir, "body.txt")
	os.WriteFile(fpath, []byte("File-based plain text"), 0644)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body sendEmailRequest
		json.NewDecoder(r.Body).Decode(&body)
		if body.Text != "File-based plain text" {
			t.Errorf("expected file content in text body, got %q", body.Text)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(sendEmailResponse{ID: "email_file004"})
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendTextFile = fpath

	var out bytes.Buffer
	sendCmd.SetOut(&out)
	if err := runSend(sendCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out.String(), "email_file004") {
		t.Errorf("expected email ID in output, got: %s", out.String())
	}
}

func TestSendNoAPIKey(t *testing.T) {
	origAPIKey := apiKey
	apiKey = ""
	defer func() { apiKey = origAPIKey }()

	err := runSend(sendCmd, nil)
	if err == nil {
		t.Fatal("expected error when no API key")
	}
	if !strings.Contains(err.Error(), "API key required") {
		t.Errorf("expected 'API key required' in error, got: %v", err)
	}
}

func TestSendServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		w.Write([]byte(`{"error":"html, text, or template is required"}`))
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendText = "something"

	err := runSend(sendCmd, nil)
	if err == nil {
		t.Fatal("expected error from server 422")
	}
	if !strings.Contains(err.Error(), "html, text, or template is required") && !strings.Contains(err.Error(), "422") {
		t.Errorf("expected server error message in error, got: %v", err)
	}
}

func TestSendAuthMissing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer srv.Close()

	defer setupSendTest(t, srv)()
	sendText = "hello"

	err := runSend(sendCmd, nil)
	if err == nil {
		t.Fatal("expected error for 401")
	}
}
