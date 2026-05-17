package opensend

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	// DefaultBaseURL is the hosted OpenSend API origin used when no base URL is configured.
	DefaultBaseURL = "https://opensend.namuh.co"
	userAgent      = "opensend-go/0.1.0"
)

// Client is a small first-party client for OpenSend's transactional send API.
type Client struct {
	apiKey     string
	baseURL    *url.URL
	httpClient *http.Client
}

// Option configures a Client.
type Option func(*Client) error

// WithBaseURL points the client at a self-hosted or alternate OpenSend API origin.
// The value must be an absolute http or https URL. Any trailing slash is ignored.
func WithBaseURL(baseURL string) Option {
	return func(c *Client) error {
		parsed, err := normalizeBaseURL(baseURL)
		if err != nil {
			return err
		}
		c.baseURL = parsed
		return nil
	}
}

// WithHTTPClient sets the HTTP client used for requests. It is useful for custom
// transports, timeouts, instrumentation, and tests.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *Client) error {
		if httpClient == nil {
			return errors.New("http client must not be nil")
		}
		c.httpClient = httpClient
		return nil
	}
}

// NewClient creates a Client using the provided API key.
func NewClient(apiKey string, options ...Option) (*Client, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, errors.New("API key is required")
	}

	baseURL, err := normalizeBaseURL(DefaultBaseURL)
	if err != nil {
		return nil, err
	}

	client := &Client{
		apiKey:     apiKey,
		baseURL:    baseURL,
		httpClient: http.DefaultClient,
	}

	for _, option := range options {
		if option == nil {
			continue
		}
		if err := option(client); err != nil {
			return nil, err
		}
	}

	return client, nil
}

// New is an alias for NewClient.
func New(apiKey string, options ...Option) (*Client, error) {
	return NewClient(apiKey, options...)
}

// SendRequest is the first OpenSend Go SDK request surface. It maps to
// POST /emails and intentionally excludes later-slice resources like
// attachments, templates, audiences, domains, or provider infrastructure.
type SendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html,omitempty"`
	Text    string   `json:"text,omitempty"`
	CC      []string `json:"cc,omitempty"`
	BCC     []string `json:"bcc,omitempty"`
	ReplyTo []string `json:"reply_to,omitempty"`
}

// SendResponse is returned when OpenSend accepts an email for processing.
type SendResponse struct {
	ID string `json:"id"`
}

// APIError represents a non-2xx response from OpenSend. StatusCode and Body are
// always populated so callers can branch on validation/auth failures even when
// the server returns an unexpected error shape.
type APIError struct {
	StatusCode int
	Body       string
	Message    string
	Name       string
	Code       string
	Details    json.RawMessage
}

func (e *APIError) Error() string {
	if e == nil {
		return "opensend: api error"
	}
	if e.Message != "" {
		return fmt.Sprintf("opensend: API request failed with status %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("opensend: API request failed with status %d", e.StatusCode)
}

// Send posts req to OpenSend's transactional send endpoint with a familiar /emails API shape.
func (c *Client) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	if c == nil {
		return nil, errors.New("opensend client is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	encoded, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("opensend: encode send request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint("/emails"), bytes.NewReader(encoded))
	if err != nil {
		return nil, fmt.Errorf("opensend: build send request: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", userAgent)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("opensend: send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("opensend: read response body: %w", err)
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, parseAPIError(resp, body)
	}

	var parsed SendResponse
	if len(body) > 0 {
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, fmt.Errorf("opensend: decode send response: %w", err)
		}
	}

	return &parsed, nil
}

func normalizeBaseURL(raw string) (*url.URL, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, errors.New("base URL must be a non-empty string when provided")
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, errors.New("base URL must be a valid absolute URL")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("base URL must use http or https")
	}

	parsed.Path = strings.TrimRight(parsed.Path, "/")
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed, nil
}

func (c *Client) endpoint(path string) string {
	base := *c.baseURL
	basePath := strings.TrimRight(base.Path, "/")
	requestPath := "/" + strings.TrimLeft(path, "/")
	if basePath == "" {
		base.Path = requestPath
	} else {
		base.Path = basePath + requestPath
	}
	base.RawQuery = ""
	base.Fragment = ""
	return base.String()
}

func parseAPIError(resp *http.Response, body []byte) *APIError {
	apiError := &APIError{
		StatusCode: resp.StatusCode,
		Body:       string(body),
		Message:    resp.Status,
	}

	var envelope struct {
		Message string          `json:"message"`
		Error   string          `json:"error"`
		Name    string          `json:"name"`
		Code    string          `json:"code"`
		Details json.RawMessage `json:"details"`
	}
	if len(body) > 0 && json.Unmarshal(body, &envelope) == nil {
		if envelope.Message != "" {
			apiError.Message = envelope.Message
		} else if envelope.Error != "" {
			apiError.Message = envelope.Error
		}
		apiError.Name = envelope.Name
		apiError.Code = envelope.Code
		apiError.Details = envelope.Details
	}

	return apiError
}
