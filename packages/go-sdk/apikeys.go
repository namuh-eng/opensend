package opensend

import (
	"context"
	"net/http"
)

// APIKeysClient provides access to the /api-keys endpoints.
type APIKeysClient struct {
	c *Client
}

// Create creates a new API key via POST /api-keys.
func (a *APIKeysClient) Create(ctx context.Context, req CreateAPIKeyRequest) (*APIKeyResponse, error) {
	var out APIKeyResponse
	if err := a.c.doJSON(ctx, http.MethodPost, "/api-keys", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves all API keys via GET /api-keys.
func (a *APIKeysClient) List(ctx context.Context) (*APIKeyListResponse, error) {
	var out APIKeyListResponse
	if err := a.c.doJSON(ctx, http.MethodGet, "/api-keys", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes an API key via DELETE /api-keys/{id}.
func (a *APIKeysClient) Delete(ctx context.Context, id string) error {
	_, status, err := a.c.do(ctx, http.MethodDelete, "/api-keys/"+id, nil, RequestOptions{})
	if err != nil {
		return err
	}
	if status < http.StatusOK || status >= http.StatusMultipleChoices {
		return parseAPIError(status, nil)
	}
	return nil
}
