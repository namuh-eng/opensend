package opensend

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

// SuppressionsClient provides access to the /api/suppressions endpoints.
type SuppressionsClient struct {
	c *Client
}

// List retrieves a paginated list of suppressions via GET /api/suppressions.
func (s *SuppressionsClient) List(ctx context.Context, opts SuppressionListOptions) (*SuppressionListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out SuppressionListResponse
	if err := s.c.doJSON(ctx, http.MethodGet, buildQuery("/api/suppressions", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a suppression by email address via GET /api/suppressions/{email}.
// The email is URL-encoded automatically.
func (s *SuppressionsClient) Get(ctx context.Context, email string) (*SuppressionPublicItem, error) {
	var out SuppressionPublicItem
	path := "/api/suppressions/" + url.PathEscape(email)
	if err := s.c.doJSON(ctx, http.MethodGet, path, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Create adds a suppression via POST /api/suppressions.
// Pass a non-empty IdempotencyKey in opts to enable idempotent creation.
func (s *SuppressionsClient) Create(ctx context.Context, req CreateSuppressionRequest, opts ...RequestOptions) (*SuppressionPublicItem, error) {
	o := mergeOpts(opts)
	var out SuppressionPublicItem
	if err := s.c.doJSON(ctx, http.MethodPost, "/api/suppressions", req, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a suppression by email address via DELETE /api/suppressions/{email}.
// The email is URL-encoded automatically.
func (s *SuppressionsClient) Delete(ctx context.Context, email string) (*DeleteSuppressionResponse, error) {
	var out DeleteSuppressionResponse
	path := "/api/suppressions/" + url.PathEscape(email)
	if err := s.c.doJSON(ctx, http.MethodDelete, path, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
