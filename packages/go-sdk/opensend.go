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
	userAgent      = "opensend-go/0.2.0"
)

// Client is the OpenSend API client. All resource namespaces are available as
// exported fields (e.g. client.Emails.Send, client.Domains.Create).
type Client struct {
	apiKey     string
	baseURL    *url.URL
	httpClient *http.Client

	// Resource namespaces
	Emails      *EmailsClient
	Domains     *DomainsClient
	APIKeys     *APIKeysClient
	Contacts    *ContactsClient
	Segments    *SegmentsClient
	Audiences   *AudiencesClient
	Broadcasts  *BroadcastsClient
	Templates   *TemplatesClient
	Automations *AutomationsClient
	Events      *EventsClient
	Webhooks    *WebhooksClient
	Topics      *TopicsClient
	Suppressions *SuppressionsClient
	Logs        *LogsClient
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

	client.Emails = &EmailsClient{c: client}
	client.Domains = &DomainsClient{c: client}
	client.APIKeys = &APIKeysClient{c: client}
	client.Contacts = &ContactsClient{c: client}
	client.Segments = &SegmentsClient{c: client}
	client.Audiences = &AudiencesClient{c: client}
	client.Broadcasts = &BroadcastsClient{c: client}
	client.Templates = &TemplatesClient{c: client}
	client.Automations = &AutomationsClient{c: client}
	client.Events = &EventsClient{c: client}
	client.Webhooks = &WebhooksClient{c: client}
	client.Topics = &TopicsClient{c: client}
	client.Suppressions = &SuppressionsClient{c: client}
	client.Logs = &LogsClient{c: client}

	return client, nil
}

// New is an alias for NewClient.
func New(apiKey string, options ...Option) (*Client, error) {
	return NewClient(apiKey, options...)
}

// SendRequest is kept for backward compatibility. Use client.Emails.Send for
// the full featured send surface (attachments, tags, scheduling, templates, etc.).
type SendRequest = SendEmailRequest

// SendResponse is returned when OpenSend accepts an email for processing.
type SendResponse = EmailResponse

// Send posts req to the transactional send endpoint. This is a backward-
// compatible alias for client.Emails.Send using the simpler SendEmailRequest type.
func (c *Client) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	return c.Emails.Send(ctx, req)
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

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

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

	// Split path and query string so we can preserve query params supplied
	// by the caller (e.g. from buildQuery) while still joining against the
	// configured base URL path.
	rawQuery := ""
	if idx := strings.IndexByte(path, '?'); idx >= 0 {
		rawQuery = path[idx+1:]
		path = path[:idx]
	}

	basePath := strings.TrimRight(base.Path, "/")
	requestPath := "/" + strings.TrimLeft(path, "/")
	if basePath == "" {
		base.Path = requestPath
	} else {
		base.Path = basePath + requestPath
	}
	base.RawQuery = rawQuery
	base.Fragment = ""
	return base.String()
}

// do executes an HTTP request against the OpenSend API. path may include a
// query string. body is JSON-encoded when non-nil. opts carries optional
// headers such as Idempotency-Key.
func (c *Client) do(ctx context.Context, method, path string, body interface{}, opts RequestOptions) ([]byte, int, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	var bodyReader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, 0, fmt.Errorf("opensend: encode request body: %w", err)
		}
		bodyReader = bytes.NewReader(encoded)
	}

	httpReq, err := http.NewRequestWithContext(ctx, method, c.endpoint(path), bodyReader)
	if err != nil {
		return nil, 0, fmt.Errorf("opensend: build request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("User-Agent", userAgent)
	if body != nil {
		httpReq.Header.Set("Content-Type", "application/json")
	}
	if opts.IdempotencyKey != "" {
		httpReq.Header.Set("Idempotency-Key", opts.IdempotencyKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, 0, fmt.Errorf("opensend: execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("opensend: read response body: %w", err)
	}

	return respBody, resp.StatusCode, nil
}

// doJSON performs a request and decodes a successful JSON body into out.
func (c *Client) doJSON(ctx context.Context, method, path string, body interface{}, opts RequestOptions, out interface{}) error {
	respBody, status, err := c.do(ctx, method, path, body, opts)
	if err != nil {
		return err
	}

	if status < http.StatusOK || status >= http.StatusMultipleChoices {
		return parseAPIError(status, respBody)
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("opensend: decode response: %w", err)
		}
	}
	return nil
}

func parseAPIError(status int, body []byte) *APIError {
	apiError := &APIError{
		StatusCode: status,
		Body:       string(body),
		Message:    http.StatusText(status),
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

// buildQuery assembles a URL path with query parameters from a flat
// map[string]string (empty string values are omitted).
func buildQuery(path string, params map[string]string) string {
	q := url.Values{}
	for k, v := range params {
		if v != "" {
			q.Set(k, v)
		}
	}
	if len(q) == 0 {
		return path
	}
	return path + "?" + q.Encode()
}
