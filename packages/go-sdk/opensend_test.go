package opensend

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func testHTTPClient(t *testing.T, fn roundTripFunc) *http.Client {
	t.Helper()
	return &http.Client{Transport: fn}
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestSendConstructsRequestWithAuthAndConfiguredBaseURL(t *testing.T) {
	var called bool
	client, err := NewClient(
		"re_test",
		WithBaseURL("https://api.example.test/base/"),
		WithHTTPClient(testHTTPClient(t, func(req *http.Request) (*http.Response, error) {
			called = true
			if req.Method != http.MethodPost {
				t.Fatalf("method = %s, want POST", req.Method)
			}
			if got := req.URL.String(); got != "https://api.example.test/base/emails" {
				t.Fatalf("url = %s, want https://api.example.test/base/emails", got)
			}
			if got := req.Header.Get("Authorization"); got != "Bearer re_test" {
				t.Fatalf("authorization = %q", got)
			}
			if got := req.Header.Get("Content-Type"); got != "application/json" {
				t.Fatalf("content-type = %q", got)
			}
			if got := req.Header.Get("Accept"); got != "application/json" {
				t.Fatalf("accept = %q", got)
			}
			if got := req.Header.Get("User-Agent"); got != userAgent {
				t.Fatalf("user-agent = %q", got)
			}

			var body map[string]any
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				t.Fatalf("decode request body: %v", err)
			}
			want := map[string]any{
				"from":     "hello@example.com",
				"to":       []any{"user@example.com"},
				"subject":  "Hello",
				"html":     "<p>Hello</p>",
				"cc":       []any{"cc@example.com"},
				"bcc":      []any{"bcc@example.com"},
				"reply_to": []any{"reply@example.com"},
			}
			for key, wantValue := range want {
				if got := body[key]; !equalJSONValue(got, wantValue) {
					t.Fatalf("body[%s] = %#v, want %#v; full body %#v", key, got, wantValue, body)
				}
			}
			if _, ok := body["replyTo"]; ok {
				t.Fatalf("body unexpectedly included replyTo: %#v", body)
			}

			return jsonResponse(http.StatusOK, `{"id":"email_123"}`), nil
		})),
	)
	if err != nil {
		t.Fatalf("NewClient returned error: %v", err)
	}

	response, err := client.Send(context.Background(), SendRequest{
		From:    "hello@example.com",
		To:      []string{"user@example.com"},
		Subject: "Hello",
		HTML:    "<p>Hello</p>",
		CC:      []string{"cc@example.com"},
		BCC:     []string{"bcc@example.com"},
		ReplyTo: []string{"reply@example.com"},
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if !called {
		t.Fatal("HTTP client was not called")
	}
	if response.ID != "email_123" {
		t.Fatalf("response id = %q, want email_123", response.ID)
	}
}

func TestNewClientDefaultsToHostedBaseURL(t *testing.T) {
	client, err := NewClient(
		"re_default",
		WithHTTPClient(testHTTPClient(t, func(req *http.Request) (*http.Response, error) {
			if got := req.URL.String(); got != "https://api.opensend.com/emails" {
				t.Fatalf("url = %s, want https://api.opensend.com/emails", got)
			}
			return jsonResponse(http.StatusOK, `{"id":"email_default"}`), nil
		})),
	)
	if err != nil {
		t.Fatalf("NewClient returned error: %v", err)
	}

	response, err := client.Send(context.Background(), SendRequest{
		From:    "hello@example.com",
		To:      []string{"user@example.com"},
		Subject: "Hello",
		Text:    "Hello",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if response.ID != "email_default" {
		t.Fatalf("response id = %q", response.ID)
	}
}

func TestSendParsesAcceptedEmailID(t *testing.T) {
	client, err := NewClient(
		"re_parse",
		WithHTTPClient(testHTTPClient(t, func(req *http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusAccepted, `{"id":"email_accepted"}`), nil
		})),
	)
	if err != nil {
		t.Fatalf("NewClient returned error: %v", err)
	}

	response, err := client.Send(context.Background(), SendRequest{
		From:    "hello@example.com",
		To:      []string{"user@example.com"},
		Subject: "Hello",
		Text:    "Hello",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if response.ID != "email_accepted" {
		t.Fatalf("response id = %q", response.ID)
	}
}

func TestSendNon2xxReturnsAPIErrorWithStatusBodyAndEnvelope(t *testing.T) {
	body := `{"name":"validation_error","code":"validation_error","message":"Validation failed.","details":{"fieldErrors":{"to":["Required"]},"formErrors":[]}}`
	client, err := NewClient(
		"re_error",
		WithHTTPClient(testHTTPClient(t, func(req *http.Request) (*http.Response, error) {
			return jsonResponse(http.StatusUnprocessableEntity, body), nil
		})),
	)
	if err != nil {
		t.Fatalf("NewClient returned error: %v", err)
	}

	_, err = client.Send(context.Background(), SendRequest{
		From:    "hello@example.com",
		To:      []string{"user@example.com"},
		Subject: "Hello",
		HTML:    "<p>Hello</p>",
	})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("error = %T %v, want *APIError", err, err)
	}
	if apiErr.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", apiErr.StatusCode)
	}
	if apiErr.Body != body {
		t.Fatalf("body = %q", apiErr.Body)
	}
	if apiErr.Name != "validation_error" || apiErr.Code != "validation_error" || apiErr.Message != "Validation failed." {
		t.Fatalf("parsed envelope = name %q code %q message %q", apiErr.Name, apiErr.Code, apiErr.Message)
	}
	if !strings.Contains(string(apiErr.Details), "fieldErrors") {
		t.Fatalf("details = %s", apiErr.Details)
	}
}

func TestClientValidation(t *testing.T) {
	if _, err := NewClient(""); err == nil || !strings.Contains(err.Error(), "API key") {
		t.Fatalf("NewClient blank key error = %v", err)
	}
	if _, err := NewClient("re_test", WithBaseURL("ftp://example.com")); err == nil || !strings.Contains(err.Error(), "http or https") {
		t.Fatalf("NewClient ftp base url error = %v", err)
	}
	if _, err := NewClient("re_test", WithHTTPClient(nil)); err == nil || !strings.Contains(err.Error(), "http client") {
		t.Fatalf("NewClient nil http client error = %v", err)
	}
}

func equalJSONValue(got any, want any) bool {
	gotJSON, err := json.Marshal(got)
	if err != nil {
		return false
	}
	wantJSON, err := json.Marshal(want)
	if err != nil {
		return false
	}
	return string(gotJSON) == string(wantJSON)
}
