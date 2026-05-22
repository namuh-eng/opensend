package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// SegmentsClient provides access to the /segments endpoints.
type SegmentsClient struct {
	c *Client
}

// Create creates a new segment via POST /segments.
func (s *SegmentsClient) Create(ctx context.Context, req CreateSegmentRequest) (*SegmentResponse, error) {
	var out SegmentResponse
	if err := s.c.doJSON(ctx, http.MethodPost, "/segments", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of segments via GET /segments.
func (s *SegmentsClient) List(ctx context.Context, opts SegmentListOptions) (*SegmentListResponse, error) {
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

	var out SegmentListResponse
	if err := s.c.doJSON(ctx, http.MethodGet, buildQuery("/segments", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single segment by ID via GET /segments/{id}.
func (s *SegmentsClient) Get(ctx context.Context, id string) (*SegmentResponse, error) {
	var out SegmentResponse
	if err := s.c.doJSON(ctx, http.MethodGet, "/segments/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes a segment via DELETE /segments/{id}.
func (s *SegmentsClient) Delete(ctx context.Context, id string) (*DeleteSegmentResponse, error) {
	var out DeleteSegmentResponse
	if err := s.c.doJSON(ctx, http.MethodDelete, "/segments/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListContacts retrieves contacts in a segment via GET /segments/{id}/contacts.
func (s *SegmentsClient) ListContacts(ctx context.Context, id string, opts ListOptions) (*SegmentContactListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}

	var out SegmentContactListResponse
	if err := s.c.doJSON(ctx, http.MethodGet, buildQuery("/segments/"+id+"/contacts", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
