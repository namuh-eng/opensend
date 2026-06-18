package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// AudiencesClient provides access to the /audiences endpoints.
type AudiencesClient struct {
	c *Client
}

// Create creates a new audience via POST /audiences.
func (a *AudiencesClient) Create(ctx context.Context, req CreateAudienceRequest) (*AudienceResponse, error) {
	var out AudienceResponse
	if err := a.c.doJSON(ctx, http.MethodPost, "/audiences", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of audiences via GET /audiences.
func (a *AudiencesClient) List(ctx context.Context, opts AudienceListOptions) (*AudienceListResponse, error) {
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

	var out AudienceListResponse
	if err := a.c.doJSON(ctx, http.MethodGet, buildQuery("/audiences", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single audience by ID via GET /audiences/{id}.
func (a *AudiencesClient) Get(ctx context.Context, id string) (*AudienceResponse, error) {
	var out AudienceResponse
	if err := a.c.doJSON(ctx, http.MethodGet, "/audiences/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes an audience via DELETE /audiences/{id}.
func (a *AudiencesClient) Delete(ctx context.Context, id string) (*DeleteAudienceResponse, error) {
	var out DeleteAudienceResponse
	if err := a.c.doJSON(ctx, http.MethodDelete, "/audiences/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
