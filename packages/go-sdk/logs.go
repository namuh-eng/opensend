package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// LogsClient provides access to the /api/logs endpoints.
type LogsClient struct {
	c *Client
}

// List retrieves a paginated list of API request logs via GET /api/logs.
func (l *LogsClient) List(ctx context.Context, opts LogListOptions) (*LogListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}
	if opts.Before != "" {
		params["before"] = opts.Before
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}
	if opts.Method != "" {
		params["method"] = opts.Method
	}
	if opts.APIKeyID != "" {
		params["api_key_id"] = opts.APIKeyID
	}
	if opts.DateFrom != "" {
		params["date_from"] = opts.DateFrom
	}
	if opts.DateTo != "" {
		params["date_to"] = opts.DateTo
	}
	if opts.UserAgent != "" {
		params["user_agent"] = opts.UserAgent
	}
	if opts.Search != "" {
		params["search"] = opts.Search
	}

	var out LogListResponse
	if err := l.c.doJSON(ctx, http.MethodGet, buildQuery("/api/logs", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single log entry by ID via GET /api/logs/{id}.
func (l *LogsClient) Get(ctx context.Context, id string) (*LogDetailResponse, error) {
	var out LogDetailResponse
	if err := l.c.doJSON(ctx, http.MethodGet, "/api/logs/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
