package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// TemplatesClient provides access to the /templates endpoints.
type TemplatesClient struct {
	c *Client
}

// Create creates a new template via POST /templates.
func (t *TemplatesClient) Create(ctx context.Context, req CreateTemplateRequest) (*TemplateIDResponse, error) {
	var out TemplateIDResponse
	if err := t.c.doJSON(ctx, http.MethodPost, "/templates", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of templates via GET /templates.
func (t *TemplatesClient) List(ctx context.Context, opts TemplateListOptions) (*TemplateListResponse, error) {
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

	var out TemplateListResponse
	if err := t.c.doJSON(ctx, http.MethodGet, buildQuery("/templates", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single template by ID or alias via GET /templates/{idOrAlias}.
func (t *TemplatesClient) Get(ctx context.Context, idOrAlias string) (*TemplateResponse, error) {
	var out TemplateResponse
	if err := t.c.doJSON(ctx, http.MethodGet, "/templates/"+idOrAlias, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a template via PATCH /templates/{idOrAlias}.
func (t *TemplatesClient) Update(ctx context.Context, idOrAlias string, req UpdateTemplateRequest) (*TemplateIDResponse, error) {
	var out TemplateIDResponse
	if err := t.c.doJSON(ctx, http.MethodPatch, "/templates/"+idOrAlias, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a template via DELETE /templates/{idOrAlias}.
func (t *TemplatesClient) Delete(ctx context.Context, idOrAlias string) (*DeleteTemplateResponse, error) {
	var out DeleteTemplateResponse
	if err := t.c.doJSON(ctx, http.MethodDelete, "/templates/"+idOrAlias, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Publish publishes the current draft of a template via POST /templates/{idOrAlias}/publish.
func (t *TemplatesClient) Publish(ctx context.Context, idOrAlias string) (*TemplateIDResponse, error) {
	var out TemplateIDResponse
	if err := t.c.doJSON(ctx, http.MethodPost, "/templates/"+idOrAlias+"/publish", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Duplicate creates a copy of a template via POST /templates/{idOrAlias}/duplicate.
func (t *TemplatesClient) Duplicate(ctx context.Context, idOrAlias string) (*TemplateIDResponse, error) {
	var out TemplateIDResponse
	if err := t.c.doJSON(ctx, http.MethodPost, "/templates/"+idOrAlias+"/duplicate", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
