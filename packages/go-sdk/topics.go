package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// TopicsClient provides access to the /api/topics endpoints.
type TopicsClient struct {
	c *Client
}

// Create creates a new topic via POST /api/topics.
func (t *TopicsClient) Create(ctx context.Context, req CreateTopicRequest) (*CreateTopicResponse, error) {
	var out CreateTopicResponse
	if err := t.c.doJSON(ctx, http.MethodPost, "/api/topics", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of topics via GET /api/topics.
func (t *TopicsClient) List(ctx context.Context, opts TopicListOptions) (*TopicListResponse, error) {
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

	var out TopicListResponse
	if err := t.c.doJSON(ctx, http.MethodGet, buildQuery("/api/topics", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single topic by ID via GET /api/topics/{id}.
func (t *TopicsClient) Get(ctx context.Context, id string) (*TopicResponse, error) {
	var out TopicResponse
	if err := t.c.doJSON(ctx, http.MethodGet, "/api/topics/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a topic via PATCH /api/topics/{id}.
func (t *TopicsClient) Update(ctx context.Context, id string, req UpdateTopicRequest) (*TopicResponse, error) {
	var out TopicResponse
	if err := t.c.doJSON(ctx, http.MethodPatch, "/api/topics/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a topic via DELETE /api/topics/{id}.
func (t *TopicsClient) Delete(ctx context.Context, id string) (*DeleteTopicResponse, error) {
	var out DeleteTopicResponse
	if err := t.c.doJSON(ctx, http.MethodDelete, "/api/topics/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
