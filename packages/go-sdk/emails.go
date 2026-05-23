package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// EmailsClient provides access to the /emails and /api/emails endpoints.
type EmailsClient struct {
	c *Client
}

// Send posts a single email to POST /emails.
// Pass a non-empty IdempotencyKey in opts to enable idempotent sends.
func (e *EmailsClient) Send(ctx context.Context, req SendEmailRequest, opts ...RequestOptions) (*EmailResponse, error) {
	o := mergeOpts(opts)
	var out EmailResponse
	if err := e.c.doJSON(ctx, http.MethodPost, "/emails", req, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// SendBatch posts multiple emails in one request to POST /emails/batch.
// Pass a non-empty IdempotencyKey in opts to enable idempotent sends.
func (e *EmailsClient) SendBatch(ctx context.Context, reqs []SendEmailRequest, opts ...RequestOptions) (*BatchEmailResponse, error) {
	o := mergeOpts(opts)
	var out BatchEmailResponse
	if err := e.c.doJSON(ctx, http.MethodPost, "/emails/batch", reqs, o, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of emails from GET /api/emails.
func (e *EmailsClient) List(ctx context.Context, opts EmailListOptions) (*EmailListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}
	if opts.Before != "" {
		params["before"] = opts.Before
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}

	var out EmailListResponse
	if err := e.c.doJSON(ctx, http.MethodGet, buildQuery("/api/emails", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single email by ID from GET /api/emails/{id}.
func (e *EmailsClient) Get(ctx context.Context, id string) (*EmailDetailResponse, error) {
	var out EmailDetailResponse
	if err := e.c.doJSON(ctx, http.MethodGet, "/api/emails/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Cancel cancels a scheduled email via POST /emails/{id}/cancel.
func (e *EmailsClient) Cancel(ctx context.Context, id string) (*CancelEmailResponse, error) {
	var out CancelEmailResponse
	if err := e.c.doJSON(ctx, http.MethodPost, "/emails/"+id+"/cancel", nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func mergeOpts(opts []RequestOptions) RequestOptions {
	if len(opts) > 0 {
		return opts[0]
	}
	return RequestOptions{}
}
