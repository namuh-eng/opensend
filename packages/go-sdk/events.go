package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// EventsClient provides access to the /api/events endpoints.
type EventsClient struct {
	c *Client
}

// Create registers a new custom event schema via POST /api/events.
func (e *EventsClient) Create(ctx context.Context, req CreateEventRequest) (*CustomEvent, error) {
	var out CustomEvent
	if err := e.c.doJSON(ctx, http.MethodPost, "/api/events", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves registered event schemas via GET /api/events.
func (e *EventsClient) List(ctx context.Context, opts ListOptions) (*CustomEventListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out CustomEventListResponse
	if err := e.c.doJSON(ctx, http.MethodGet, buildQuery("/api/events", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Send fires a custom event via POST /api/events/send.
func (e *EventsClient) Send(ctx context.Context, req SendEventRequest) (*SendCustomEventResponse, error) {
	var out SendCustomEventResponse
	if err := e.c.doJSON(ctx, http.MethodPost, "/api/events/send", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
