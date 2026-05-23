package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// ContactsClient provides access to the /contacts endpoints.
type ContactsClient struct {
	c *Client
}

// Create creates a new contact via POST /contacts.
func (cl *ContactsClient) Create(ctx context.Context, req CreateContactRequest) (*CreateContactResponse, error) {
	var out CreateContactResponse
	if err := cl.c.doJSON(ctx, http.MethodPost, "/contacts", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of contacts via GET /contacts.
func (cl *ContactsClient) List(ctx context.Context, opts ListOptions) (*ContactListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out ContactListResponse
	if err := cl.c.doJSON(ctx, http.MethodGet, buildQuery("/contacts", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single contact by ID via GET /contacts/{id}.
func (cl *ContactsClient) Get(ctx context.Context, id string) (*ContactResponse, error) {
	var out ContactResponse
	if err := cl.c.doJSON(ctx, http.MethodGet, "/contacts/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates a contact via PATCH /contacts/{id}.
func (cl *ContactsClient) Update(ctx context.Context, id string, req UpdateContactRequest) (*ContactResponse, error) {
	var out ContactResponse
	if err := cl.c.doJSON(ctx, http.MethodPatch, "/contacts/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a contact via DELETE /contacts/{id}.
func (cl *ContactsClient) Delete(ctx context.Context, id string) (*DeleteContactResponse, error) {
	var out DeleteContactResponse
	if err := cl.c.doJSON(ctx, http.MethodDelete, "/contacts/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
