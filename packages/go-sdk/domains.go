package opensend

import (
	"context"
	"net/http"
)

// DomainsClient provides access to the /api/domains endpoints.
type DomainsClient struct {
	c *Client
}

// Create adds a new domain via POST /api/domains.
func (d *DomainsClient) Create(ctx context.Context, req CreateDomainRequest) (*DomainResponse, error) {
	var out DomainResponse
	if err := d.c.doJSON(ctx, http.MethodPost, "/api/domains", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves all domains via GET /api/domains.
func (d *DomainsClient) List(ctx context.Context) (*DomainListResponse, error) {
	var out DomainListResponse
	if err := d.c.doJSON(ctx, http.MethodGet, "/api/domains", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single domain by ID via GET /api/domains/{id}.
func (d *DomainsClient) Get(ctx context.Context, id string) (*DomainResponse, error) {
	var out DomainResponse
	if err := d.c.doJSON(ctx, http.MethodGet, "/api/domains/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a domain via PATCH /api/domains/{id}.
func (d *DomainsClient) Update(ctx context.Context, id string, req UpdateDomainRequest) (*DomainUpdateResponse, error) {
	var out DomainUpdateResponse
	if err := d.c.doJSON(ctx, http.MethodPatch, "/api/domains/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Verify triggers DNS verification for a domain via POST /api/domains/{id}/verify.
func (d *DomainsClient) Verify(ctx context.Context, id string) (*DomainResponse, error) {
	var out DomainResponse
	if err := d.c.doJSON(ctx, http.MethodPost, "/api/domains/"+id+"/verify", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a domain via DELETE /api/domains/{id}.
func (d *DomainsClient) Delete(ctx context.Context, id string) (*DeleteDomainResponse, error) {
	var out DeleteDomainResponse
	if err := d.c.doJSON(ctx, http.MethodDelete, "/api/domains/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
