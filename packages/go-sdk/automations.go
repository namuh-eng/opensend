package opensend

import (
	"context"
	"fmt"
	"net/http"
)

// AutomationsClient provides access to the /api/automations endpoints.
type AutomationsClient struct {
	c *Client
}

// Create creates a new automation via POST /api/automations.
func (a *AutomationsClient) Create(ctx context.Context, req CreateAutomationRequest) (*AutomationDetailResponse, error) {
	var out AutomationDetailResponse
	if err := a.c.doJSON(ctx, http.MethodPost, "/api/automations", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// List retrieves a paginated list of automations via GET /api/automations.
func (a *AutomationsClient) List(ctx context.Context, opts AutomationListOptions) (*AutomationListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}

	var out AutomationListResponse
	if err := a.c.doJSON(ctx, http.MethodGet, buildQuery("/api/automations", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Get retrieves a single automation by ID via GET /api/automations/{id}.
func (a *AutomationsClient) Get(ctx context.Context, id string) (*AutomationDetailResponse, error) {
	var out AutomationDetailResponse
	if err := a.c.doJSON(ctx, http.MethodGet, "/api/automations/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Update partially updates an automation via PATCH /api/automations/{id}.
func (a *AutomationsClient) Update(ctx context.Context, id string, req UpdateAutomationRequest) (*AutomationDetailResponse, error) {
	var out AutomationDetailResponse
	if err := a.c.doJSON(ctx, http.MethodPatch, "/api/automations/"+id, req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Delete removes an automation via DELETE /api/automations/{id}.
func (a *AutomationsClient) Delete(ctx context.Context, id string) (*AutomationDeleteResponse, error) {
	var out AutomationDeleteResponse
	if err := a.c.doJSON(ctx, http.MethodDelete, "/api/automations/"+id, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ListRuns retrieves automation run history via GET /api/automations/{id}/runs.
func (a *AutomationsClient) ListRuns(ctx context.Context, id string, opts AutomationRunListOptions) (*AutomationRunListResponse, error) {
	params := map[string]string{}
	if opts.Limit != nil {
		params["limit"] = fmt.Sprintf("%d", *opts.Limit)
	}
	if opts.After != "" {
		params["after"] = opts.After
	}
	if opts.Status != "" {
		params["status"] = opts.Status
	}

	var out AutomationRunListResponse
	if err := a.c.doJSON(ctx, http.MethodGet, buildQuery("/api/automations/"+id+"/runs", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetRun retrieves a single automation run via GET /api/automations/{id}/runs/{runId}.
func (a *AutomationsClient) GetRun(ctx context.Context, id, runID string) (*AutomationRunDetailItem, error) {
	var out AutomationRunDetailItem
	if err := a.c.doJSON(ctx, http.MethodGet, "/api/automations/"+id+"/runs/"+runID, nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// CancelRun cancels a running automation run via POST /api/automations/{id}/runs/{runId}/cancel.
func (a *AutomationsClient) CancelRun(ctx context.Context, id, runID string, req CancelAutomationRunRequest) (*AutomationRunDetailItem, error) {
	var out AutomationRunDetailItem
	if err := a.c.doJSON(ctx, http.MethodPost, "/api/automations/"+id+"/runs/"+runID+"/cancel", req, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// GetRunMetrics retrieves aggregate run metrics via GET /api/automations/{id}/runs/metrics.
func (a *AutomationsClient) GetRunMetrics(ctx context.Context, id string, opts AutomationRunMetricsOptions) (*AutomationRunMetricsResponse, error) {
	params := map[string]string{}
	if opts.From != "" {
		params["from"] = opts.From
	}
	if opts.To != "" {
		params["to"] = opts.To
	}

	var out AutomationRunMetricsResponse
	if err := a.c.doJSON(ctx, http.MethodGet, buildQuery("/api/automations/"+id+"/runs/metrics", params), nil, RequestOptions{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
