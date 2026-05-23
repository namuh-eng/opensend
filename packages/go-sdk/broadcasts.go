package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// BroadcastsClient provides access to the /broadcasts endpoints.
type BroadcastsClient struct {
	c *Client
}

// Create creates a new broadcast via POST /broadcasts.
// Pass a non-empty IdempotencyKey in opts to enable idempotent creation.
func (b *BroadcastsClient) Create(ctx context.Context, req CreateBroadcastRequest, opts ...RequestOptions) (*CreateBroadcastResponse, error) {
	o := mergeOpts(opts)
	var out CreateBroadcastResponse
	if err := b.c.doJSON(ctx, http.MethodPost, "/broadcasts", req, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of broadcasts via GET /broadcasts.
func (b *BroadcastsClient) List(ctx context.Context, opts BroadcastListOptions) (*BroadcastListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}
	if opts.Search != "" {
		params["search"] = opts.Search
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}
	if opts.SegmentID != "" {
		params["segmentId"] = opts.SegmentID
	}

	var out BroadcastListResponse
	if err := b.c.doJSON(ctx, http.MethodGet, buildQuery("/broadcasts", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single broadcast by ID via GET /broadcasts/{id}.
func (b *BroadcastsClient) Get(ctx context.Context, id string) (*BroadcastResponse, error) {
	var out BroadcastResponse
	if err := b.c.doJSON(ctx, http.MethodGet, "/broadcasts/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a broadcast via PATCH /broadcasts/{id}.
func (b *BroadcastsClient) Update(ctx context.Context, id string, req UpdateBroadcastRequest) (*BroadcastResponse, error) {
	var out BroadcastResponse
	if err := b.c.doJSON(ctx, http.MethodPatch, "/broadcasts/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a broadcast via DELETE /broadcasts/{id}.
func (b *BroadcastsClient) Delete(ctx context.Context, id string) (*DeleteBroadcastResponse, error) {
	var out DeleteBroadcastResponse
	if err := b.c.doJSON(ctx, http.MethodDelete, "/broadcasts/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Send triggers sending of a broadcast via POST /broadcasts/{id}/send.
// Pass a non-empty IdempotencyKey in opts to enable idempotent sends.
func (b *BroadcastsClient) Send(ctx context.Context, id string, req SendBroadcastRequest, opts ...RequestOptions) (*SendBroadcastResponse, error) {
	o := mergeOpts(opts)
	var out SendBroadcastResponse
	if err := b.c.doJSON(ctx, http.MethodPost, "/broadcasts/"+id+"/send", req, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
