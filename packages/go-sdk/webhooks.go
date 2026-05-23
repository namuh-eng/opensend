package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// WebhooksClient provides access to the /api/webhooks endpoints.
type WebhooksClient struct {
	c *Client
}

// Create registers a new webhook endpoint via POST /api/webhooks.
func (w *WebhooksClient) Create(ctx context.Context, req CreateWebhookRequest, opts ...RequestOptions) (*WebhookCreateResponse, error) {
	o := mergeOpts(opts)
	var out WebhookCreateResponse
	if err := w.c.doJSON(ctx, http.MethodPost, "/api/webhooks", req, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of webhooks via GET /api/webhooks.
func (w *WebhooksClient) List(ctx context.Context, opts WebhookListOptions) (*WebhookListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out WebhookListResponse
	if err := w.c.doJSON(ctx, http.MethodGet, buildQuery("/api/webhooks", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single webhook by ID via GET /api/webhooks/{id}.
func (w *WebhooksClient) Get(ctx context.Context, id string) (*WebhookDetailResponse, error) {
	var out WebhookDetailResponse
	if err := w.c.doJSON(ctx, http.MethodGet, "/api/webhooks/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a webhook via PATCH /api/webhooks/{id}.
func (w *WebhooksClient) Update(ctx context.Context, id string, req UpdateWebhookRequest) (*WebhookUpdateResponse, error) {
	var out WebhookUpdateResponse
	if err := w.c.doJSON(ctx, http.MethodPatch, "/api/webhooks/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a webhook via DELETE /api/webhooks/{id}.
func (w *WebhooksClient) Delete(ctx context.Context, id string) (*DeleteWebhookResponse, error) {
	var out DeleteWebhookResponse
	if err := w.c.doJSON(ctx, http.MethodDelete, "/api/webhooks/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListDeliveries retrieves delivery attempts for a webhook via GET /api/webhooks/{id}/deliveries.
func (w *WebhooksClient) ListDeliveries(ctx context.Context, id string, opts ListOptions) (*WebhookDeliveryListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out WebhookDeliveryListResponse
	if err := w.c.doJSON(ctx, http.MethodGet, buildQuery("/api/webhooks/"+id+"/deliveries", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ReplayDelivery replays a specific delivery attempt via POST /api/webhooks/{id}/deliveries/{deliveryId}/replay.
func (w *WebhooksClient) ReplayDelivery(ctx context.Context, id, deliveryID string) (*WebhookDeliveryReplayResponse, error) {
	var out WebhookDeliveryReplayResponse
	if err := w.c.doJSON(ctx, http.MethodPost, "/api/webhooks/"+id+"/deliveries/"+deliveryID+"/replay", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
