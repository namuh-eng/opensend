package opensend

import "encoding/json"

// ---------------------------------------------------------------------------
// Shared list option helpers
// ---------------------------------------------------------------------------

// ListOptions holds common cursor-pagination parameters.
type ListOptions struct {
	Limit *int
	After string
}

// ---------------------------------------------------------------------------
// Email types
// ---------------------------------------------------------------------------

// EmailAttachment describes a file attached to an outgoing email.
type EmailAttachment struct {
	Filename    string `json:"filename"`
	Content     string `json:"content,omitempty"`
	Path        string `json:"path,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	ContentID   string `json:"content_id,omitempty"`
}

// EmailTag is a key/value metadata tag on an email.
type EmailTag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// EmailTemplateReference selects a stored template for an outgoing email.
type EmailTemplateReference struct {
	ID        string                 `json:"id"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

// EmailStatus enumerates every lifecycle state an email can be in.
type EmailStatus = string

const (
	EmailStatusQueued          EmailStatus = "queued"
	EmailStatusProcessing      EmailStatus = "processing"
	EmailStatusScheduled       EmailStatus = "scheduled"
	EmailStatusSent            EmailStatus = "sent"
	EmailStatusFailed          EmailStatus = "failed"
	EmailStatusDelivered       EmailStatus = "delivered"
	EmailStatusDeliveryDelayed EmailStatus = "delivery_delayed"
	EmailStatusBounced         EmailStatus = "bounced"
	EmailStatusHardBounced     EmailStatus = "hard_bounced"
	EmailStatusSoftBounced     EmailStatus = "soft_bounced"
	EmailStatusComplained      EmailStatus = "complained"
	EmailStatusOpened          EmailStatus = "opened"
	EmailStatusClicked         EmailStatus = "clicked"
	EmailStatusSuppressed      EmailStatus = "suppressed"
	EmailStatusCanceled        EmailStatus = "canceled"
	EmailStatusCancelled       EmailStatus = "cancelled"
)

// SendEmailRequest is the payload for POST /emails.
type SendEmailRequest struct {
	From        string                  `json:"from"`
	To          []string                `json:"to"`
	Subject     string                  `json:"subject"`
	HTML        string                  `json:"html,omitempty"`
	Text        string                  `json:"text,omitempty"`
	CC          []string                `json:"cc,omitempty"`
	BCC         []string                `json:"bcc,omitempty"`
	ReplyTo     []string                `json:"reply_to,omitempty"`
	Headers     map[string]string       `json:"headers,omitempty"`
	Attachments []EmailAttachment       `json:"attachments,omitempty"`
	Tags        []EmailTag              `json:"tags,omitempty"`
	ScheduledAt string                  `json:"scheduled_at,omitempty"`
	TopicID     string                  `json:"topic_id,omitempty"`
	Template    *EmailTemplateReference `json:"template,omitempty"`
}

// EmailResponse is returned after a successful POST /emails.
type EmailResponse struct {
	ID string `json:"id"`
}

// BatchEmailItemError carries an error for a single item in a batch send.
type BatchEmailItemError struct {
	Error struct {
		Name       string          `json:"name"`
		Code       string          `json:"code"`
		Message    string          `json:"message"`
		StatusCode int             `json:"statusCode"`
		Details    json.RawMessage `json:"details,omitempty"`
	} `json:"error"`
}

// BatchEmailItemResponse is either an EmailResponse or a BatchEmailItemError.
// Use the ID field — if empty, check Error.
type BatchEmailItemResponse struct {
	ID    string `json:"id"`
	Error *struct {
		Name       string          `json:"name"`
		Code       string          `json:"code"`
		Message    string          `json:"message"`
		StatusCode int             `json:"statusCode"`
		Details    json.RawMessage `json:"details,omitempty"`
	} `json:"error,omitempty"`
}

// BatchEmailResponse is returned by POST /emails/batch.
type BatchEmailResponse struct {
	Data []BatchEmailItemResponse `json:"data"`
}

// EmailListOptions controls filtering/pagination for GET /api/emails.
type EmailListOptions struct {
	Limit  *int
	After  string
	Before string
	Status EmailStatus
}

// ProviderRetryVisibility contains SES-level retry diagnostics.
type ProviderRetryVisibility struct {
	ProviderRetryCount    int         `json:"provider_retry_count"`
	ProviderLastAttempted *string     `json:"provider_last_attempted_at"`
	ProviderNextRetry     *string     `json:"provider_next_retry_at"`
	ProviderLastError     interface{} `json:"provider_last_error"`
	ProviderDeadLettered  *string     `json:"provider_dead_lettered_at"`
}

// EmailListItem represents one row in the email list.
type EmailListItem struct {
	ProviderRetryVisibility
	ID          string      `json:"id"`
	From        string      `json:"from"`
	To          []string    `json:"to"`
	Subject     string      `json:"subject"`
	CC          []string    `json:"cc"`
	BCC         []string    `json:"bcc"`
	ReplyTo     []string    `json:"reply_to"`
	LastEvent   EmailStatus `json:"last_event"`
	ScheduledAt *string     `json:"scheduled_at"`
	SentAt      *string     `json:"sent_at"`
	CreatedAt   string      `json:"created_at"`
}

// EmailListResponse is returned by GET /api/emails.
type EmailListResponse struct {
	Object  string          `json:"object"`
	HasMore bool            `json:"has_more"`
	Data    []EmailListItem `json:"data"`
}

// EmailDetailResponse extends EmailListItem with body fields.
type EmailDetailResponse struct {
	EmailListItem
	Object string     `json:"object"`
	HTML   *string    `json:"html"`
	Text   *string    `json:"text"`
	Tags   []EmailTag `json:"tags"`
}

// CancelEmailResponse is returned by POST /emails/{id}/cancel.
type CancelEmailResponse struct {
	Object string `json:"object"`
	ID     string `json:"id"`
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

// DomainCapability is an optional feature toggle for a domain.
type DomainCapability struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

// DomainRecord is a DNS record entry for a domain.
type DomainRecord struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	Value    string `json:"value"`
	Status   string `json:"status"`
	TTL      string `json:"ttl"`
	Priority *int   `json:"priority,omitempty"`
}

// CreateDomainRequest is the payload for POST /api/domains.
type CreateDomainRequest struct {
	Name              string             `json:"name"`
	Region            string             `json:"region,omitempty"`
	CustomReturnPath  string             `json:"custom_return_path,omitempty"`
	OpenTracking      *bool              `json:"open_tracking,omitempty"`
	ClickTracking     *bool              `json:"click_tracking,omitempty"`
	TrackingSubdomain string             `json:"tracking_subdomain,omitempty"`
	TLS               string             `json:"tls,omitempty"`
	Capabilities      []DomainCapability `json:"capabilities,omitempty"`
}

// UpdateDomainRequest is the payload for PATCH /api/domains/{id}.
type UpdateDomainRequest struct {
	ClickTracking     *bool              `json:"click_tracking,omitempty"`
	OpenTracking      *bool              `json:"open_tracking,omitempty"`
	TrackingSubdomain *string            `json:"tracking_subdomain,omitempty"`
	Capabilities      []DomainCapability `json:"capabilities,omitempty"`
	SendingEnabled    *bool              `json:"sending_enabled,omitempty"`
	ReceivingEnabled  *bool              `json:"receiving_enabled,omitempty"`
	TLS               string             `json:"tls,omitempty"`
}

// DomainResponse is the full domain resource returned by the API.
type DomainResponse struct {
	Object            string             `json:"object"`
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Status            string             `json:"status"`
	Region            string             `json:"region"`
	Records           []DomainRecord     `json:"records"`
	CustomReturnPath  *string            `json:"custom_return_path"`
	ReturnPath        string             `json:"return_path,omitempty"`
	OpenTracking      bool               `json:"open_tracking,omitempty"`
	ClickTracking     bool               `json:"click_tracking,omitempty"`
	TrackingSubdomain *string            `json:"tracking_subdomain"`
	TLS               string             `json:"tls,omitempty"`
	Capabilities      []DomainCapability `json:"capabilities,omitempty"`
	CreatedAt         string             `json:"created_at"`
}

// DomainUpdateResponse is the response from PATCH /api/domains/{id}.
type DomainUpdateResponse struct {
	Object string `json:"object"`
	ID     string `json:"id"`
}

// DomainListItem is one row in the domain list.
type DomainListItem struct {
	ID           string             `json:"id"`
	Name         string             `json:"name"`
	Status       string             `json:"status"`
	Region       string             `json:"region"`
	Capabilities []DomainCapability `json:"capabilities"`
	CreatedAt    string             `json:"created_at"`
}

// DomainListResponse is returned by GET /api/domains.
type DomainListResponse struct {
	Object  string           `json:"object"`
	Data    []DomainListItem `json:"data"`
	HasMore bool             `json:"has_more"`
}

// DeleteDomainResponse is returned by DELETE /api/domains/{id}.
type DeleteDomainResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// ---------------------------------------------------------------------------
// API key types
// ---------------------------------------------------------------------------

// CreateAPIKeyRequest is the payload for POST /api-keys.
type CreateAPIKeyRequest struct {
	Name       string `json:"name"`
	Permission string `json:"permission,omitempty"`
	DomainID   string `json:"domain_id,omitempty"`
}

// APIKeyResponse is returned when an API key is created.
type APIKeyResponse struct {
	ID    string `json:"id"`
	Token string `json:"token"`
}

// APIKeyListItem is one row in the API key list.
type APIKeyListItem struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	CreatedAt  string  `json:"created_at"`
	LastUsedAt *string `json:"last_used_at"`
}

// APIKeyListResponse is returned by GET /api-keys.
type APIKeyListResponse struct {
	Object  string           `json:"object"`
	Data    []APIKeyListItem `json:"data"`
	HasMore bool             `json:"has_more"`
}

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------

// ContactTopicInput allows specifying a topic by ID with an explicit subscription.
type ContactTopicInput struct {
	ID           string `json:"id"`
	Subscription string `json:"subscription"`
}

// CreateContactRequest is the payload for POST /contacts.
type CreateContactRequest struct {
	Email       string             `json:"email"`
	FirstName   string             `json:"first_name,omitempty"`
	LastName    string             `json:"last_name,omitempty"`
	Unsubscribed *bool             `json:"unsubscribed,omitempty"`
	Properties  map[string]string  `json:"properties,omitempty"`
	Segments    []string           `json:"segments,omitempty"`
	Topics      []ContactTopicInput `json:"topics,omitempty"`
}

// UpdateContactRequest is the payload for PATCH /contacts/{id}.
type UpdateContactRequest struct {
	Email       string             `json:"email,omitempty"`
	FirstName   string             `json:"first_name,omitempty"`
	LastName    string             `json:"last_name,omitempty"`
	Unsubscribed *bool             `json:"unsubscribed,omitempty"`
	Properties  map[string]string  `json:"properties,omitempty"`
	Segments    []string           `json:"segments,omitempty"`
	Topics      []ContactTopicInput `json:"topics,omitempty"`
}

// CreateContactResponse is returned by POST /contacts.
type CreateContactResponse struct {
	Object string `json:"object"`
	ID     string `json:"id"`
}

// ContactTopicPreference represents a contact's subscription to a topic.
type ContactTopicPreference struct {
	ID           string `json:"id"`
	Subscription string `json:"subscription"`
}

// ContactResponse is the full contact resource.
type ContactResponse struct {
	Object       string                   `json:"object"`
	ID           string                   `json:"id"`
	Email        string                   `json:"email"`
	FirstName    *string                  `json:"first_name"`
	LastName     *string                  `json:"last_name"`
	Unsubscribed bool                     `json:"unsubscribed"`
	Properties   map[string]string        `json:"properties"`
	Segments     []string                 `json:"segments"`
	Topics       []ContactTopicPreference `json:"topics"`
	CreatedAt    string                   `json:"created_at"`
}

// ContactListItem is one row in the contact list.
type ContactListItem struct {
	ID           string  `json:"id"`
	Email        string  `json:"email"`
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	Unsubscribed bool    `json:"unsubscribed"`
	Status       string  `json:"status"`
	Segments     []string `json:"segments"`
	CreatedAt    string  `json:"created_at"`
}

// ContactListResponse is returned by GET /contacts.
type ContactListResponse struct {
	Object  string            `json:"object"`
	Data    []ContactListItem `json:"data"`
	HasMore bool              `json:"has_more"`
}

// DeleteContactResponse is returned by DELETE /contacts/{id}.
type DeleteContactResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// ---------------------------------------------------------------------------
// Segment types
// ---------------------------------------------------------------------------

// CreateSegmentRequest is the payload for POST /segments.
type CreateSegmentRequest struct {
	Name string `json:"name"`
}

// SegmentResponse is the full segment resource.
type SegmentResponse struct {
	Object    string  `json:"object"`
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	CreatedAt *string `json:"created_at,omitempty"`
}

// SegmentListItem is one row in the segment list.
type SegmentListItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

// SegmentListOptions controls filtering/pagination for GET /segments.
type SegmentListOptions struct {
	Limit  *int
	After  string
	Search string
}

// SegmentListResponse is returned by GET /segments.
type SegmentListResponse struct {
	Object  string            `json:"object"`
	Data    []SegmentListItem `json:"data"`
	HasMore bool              `json:"has_more"`
	Total   *int              `json:"total,omitempty"`
}

// DeleteSegmentResponse is returned by DELETE /segments/{id}.
type DeleteSegmentResponse struct {
	Success bool `json:"success"`
}

// SegmentContactListItem is one contact row from GET /segments/{id}/contacts.
type SegmentContactListItem struct {
	ID        string  `json:"id"`
	Email     string  `json:"email"`
	FirstName *string `json:"firstName"`
	LastName  *string `json:"lastName"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"created_at"`
}

// SegmentContactListResponse is returned by GET /segments/{id}/contacts.
type SegmentContactListResponse struct {
	Object  string                   `json:"object"`
	Data    []SegmentContactListItem `json:"data"`
	HasMore bool                     `json:"has_more"`
}

// ---------------------------------------------------------------------------
// Audience types
// ---------------------------------------------------------------------------

// CreateAudienceRequest is the payload for POST /audiences.
type CreateAudienceRequest struct {
	Name string `json:"name"`
}

// AudienceResponse is the full audience resource.
type AudienceResponse struct {
	Object    string  `json:"object"`
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	CreatedAt *string `json:"created_at,omitempty"`
}

// AudienceListItem is one row in the audience list.
type AudienceListItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

// AudienceListOptions controls filtering/pagination for GET /audiences.
type AudienceListOptions struct {
	Limit  *int
	After  string
	Search string
}

// AudienceListResponse is returned by GET /audiences.
type AudienceListResponse struct {
	Object  string             `json:"object"`
	Data    []AudienceListItem `json:"data"`
	HasMore bool               `json:"has_more"`
}

// DeleteAudienceResponse is returned by DELETE /audiences/{id}.
type DeleteAudienceResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// ---------------------------------------------------------------------------
// Broadcast types
// ---------------------------------------------------------------------------

// BroadcastStatus enumerates the lifecycle states of a broadcast.
type BroadcastStatus = string

const (
	BroadcastStatusDraft     BroadcastStatus = "draft"
	BroadcastStatusScheduled BroadcastStatus = "scheduled"
	BroadcastStatusQueued    BroadcastStatus = "queued"
	BroadcastStatusSent      BroadcastStatus = "sent"
	BroadcastStatusFailed    BroadcastStatus = "failed"
)

// CreateBroadcastRequest is the payload for POST /broadcasts.
type CreateBroadcastRequest struct {
	Name        string `json:"name,omitempty"`
	From        string `json:"from"`
	Subject     string `json:"subject"`
	HTML        string `json:"html,omitempty"`
	Text        string `json:"text,omitempty"`
	Send        *bool  `json:"send,omitempty"`
	SegmentID   string `json:"segment_id,omitempty"`
	TopicID     string `json:"topic_id,omitempty"`
	ReplyTo     string `json:"reply_to,omitempty"`
	PreviewText string `json:"preview_text,omitempty"`
	ScheduledAt string `json:"scheduled_at,omitempty"`
}

// UpdateBroadcastRequest is the payload for PATCH /broadcasts/{id}.
type UpdateBroadcastRequest struct {
	Name        string `json:"name,omitempty"`
	From        string `json:"from,omitempty"`
	Subject     string `json:"subject,omitempty"`
	HTML        string `json:"html,omitempty"`
	Text        string `json:"text,omitempty"`
	Send        *bool  `json:"send,omitempty"`
	SegmentID   string `json:"segment_id,omitempty"`
	TopicID     string `json:"topic_id,omitempty"`
	ReplyTo     string `json:"reply_to,omitempty"`
	PreviewText string `json:"preview_text,omitempty"`
	ScheduledAt string `json:"scheduled_at,omitempty"`
}

// SendBroadcastRequest is the payload for POST /broadcasts/{id}/send.
type SendBroadcastRequest struct {
	ScheduledAt string `json:"scheduled_at,omitempty"`
}

// BroadcastListOptions controls filtering/pagination for GET /broadcasts.
type BroadcastListOptions struct {
	Limit     *int
	After     string
	Search    string
	Status    BroadcastStatus
	SegmentID string
}

// BroadcastListItem is one row in the broadcast list.
type BroadcastListItem struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Status      BroadcastStatus `json:"status"`
	AudienceID  *string         `json:"audience_id"`
	TopicID     *string         `json:"topic_id"`
	CreatedAt   string          `json:"created_at"`
	ScheduledAt *string         `json:"scheduled_at"`
}

// BroadcastListResponse is returned by GET /broadcasts.
type BroadcastListResponse struct {
	Object  string              `json:"object"`
	Data    []BroadcastListItem `json:"data"`
	HasMore bool                `json:"has_more"`
}

// BroadcastResponse is the full broadcast resource.
type BroadcastResponse struct {
	BroadcastListItem
	Object      string  `json:"object"`
	From        *string `json:"from"`
	Subject     *string `json:"subject"`
	HTML        *string `json:"html"`
	Text        *string `json:"text"`
	ReplyTo     *string `json:"reply_to"`
	PreviewText *string `json:"preview_text"`
}

// CreateBroadcastResponse is returned by POST /broadcasts.
type CreateBroadcastResponse struct {
	Object    string `json:"object"`
	ID        string `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// DeleteBroadcastResponse is returned by DELETE /broadcasts/{id}.
type DeleteBroadcastResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// SendBroadcastResponse is returned by POST /broadcasts/{id}/send.
type SendBroadcastResponse struct {
	Object      string  `json:"object"`
	ID          string  `json:"id"`
	Status      string  `json:"status"`
	ScheduledAt *string `json:"scheduled_at"`
}

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

// TemplateStatus enumerates template lifecycle states.
type TemplateStatus = string

const (
	TemplateStatusDraft     TemplateStatus = "draft"
	TemplateStatusPublished TemplateStatus = "published"
)

// TemplateVariable is a variable slot in a template.
type TemplateVariable struct {
	Key          string      `json:"key"`
	Name         string      `json:"name,omitempty"`
	Type         string      `json:"type,omitempty"`
	Required     *bool       `json:"required,omitempty"`
	FallbackValue interface{} `json:"fallback_value,omitempty"`
}

// CreateTemplateRequest is the payload for POST /templates.
type CreateTemplateRequest struct {
	Name        string             `json:"name"`
	Alias       *string            `json:"alias,omitempty"`
	From        *string            `json:"from,omitempty"`
	Subject     *string            `json:"subject,omitempty"`
	HTML        string             `json:"html,omitempty"`
	Text        *string            `json:"text,omitempty"`
	ReplyTo     interface{}        `json:"reply_to,omitempty"`
	PreviewText *string            `json:"preview_text,omitempty"`
	Variables   []TemplateVariable `json:"variables,omitempty"`
}

// UpdateTemplateRequest is the payload for PATCH /templates/{id}.
type UpdateTemplateRequest struct {
	Name        string             `json:"name,omitempty"`
	Alias       *string            `json:"alias,omitempty"`
	From        *string            `json:"from,omitempty"`
	Subject     *string            `json:"subject,omitempty"`
	HTML        string             `json:"html,omitempty"`
	Text        *string            `json:"text,omitempty"`
	ReplyTo     interface{}        `json:"reply_to,omitempty"`
	PreviewText *string            `json:"preview_text,omitempty"`
	Variables   []TemplateVariable `json:"variables,omitempty"`
	Status      TemplateStatus     `json:"status,omitempty"`
}

// TemplateListOptions controls filtering/pagination for GET /templates.
type TemplateListOptions struct {
	Limit  *int
	After  string
	Search string
	Status TemplateStatus
}

// TemplateListItem is one row in the template list.
type TemplateListItem struct {
	Object               string  `json:"object"`
	ID                   string  `json:"id"`
	Name                 string  `json:"name"`
	Alias                *string `json:"alias"`
	Status               string  `json:"status"`
	CurrentVersionID     *string `json:"current_version_id,omitempty"`
	PublishedAt          *string `json:"published_at,omitempty"`
	HasUnpublishedVersions *bool `json:"has_unpublished_versions,omitempty"`
	CreatedAt            string  `json:"created_at"`
}

// TemplateListResponse is returned by GET /templates.
type TemplateListResponse struct {
	Object  string             `json:"object"`
	Data    []TemplateListItem `json:"data"`
	HasMore bool               `json:"has_more"`
}

// TemplateResponse is the full template resource.
type TemplateResponse struct {
	TemplateListItem
	Subject     *string            `json:"subject,omitempty"`
	From        *string            `json:"from,omitempty"`
	ReplyTo     interface{}        `json:"reply_to,omitempty"`
	PreviewText *string            `json:"preview_text,omitempty"`
	HTML        *string            `json:"html,omitempty"`
	Text        *string            `json:"text,omitempty"`
	Variables   []TemplateVariable `json:"variables,omitempty"`
	UpdatedAt   *string            `json:"updated_at,omitempty"`
}

// TemplateIDResponse carries only object + id for create/update/publish/duplicate.
type TemplateIDResponse struct {
	Object string `json:"object"`
	ID     string `json:"id"`
}

// DeleteTemplateResponse is returned by DELETE /templates/{id}.
type DeleteTemplateResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// ---------------------------------------------------------------------------
// Automation types
// ---------------------------------------------------------------------------

// AutomationStatus enumerates automation lifecycle states.
type AutomationStatus = string

const (
	AutomationStatusDraft    AutomationStatus = "draft"
	AutomationStatusEnabled  AutomationStatus = "enabled"
	AutomationStatusDisabled AutomationStatus = "disabled"
)

// AutomationRunStatus enumerates automation run lifecycle states.
type AutomationRunStatus = string

const (
	AutomationRunStatusQueued    AutomationRunStatus = "queued"
	AutomationRunStatusRunning   AutomationRunStatus = "running"
	AutomationRunStatusWaiting   AutomationRunStatus = "waiting"
	AutomationRunStatusCompleted AutomationRunStatus = "completed"
	AutomationRunStatusFailed    AutomationRunStatus = "failed"
	AutomationRunStatusCancelled AutomationRunStatus = "cancelled"
	AutomationRunStatusSkipped   AutomationRunStatus = "skipped"
)

// AutomationStepPayload defines a single step in an automation.
type AutomationStepPayload struct {
	Key      string                 `json:"key"`
	Type     string                 `json:"type"`
	Config   map[string]interface{} `json:"config,omitempty"`
	Position *int                   `json:"position,omitempty"`
}

// AutomationConnectionPayload defines an edge between two steps.
type AutomationConnectionPayload struct {
	From string `json:"from"`
	To   string `json:"to"`
	Type string `json:"type,omitempty"`
}

// CreateAutomationRequest is the payload for POST /api/automations.
type CreateAutomationRequest struct {
	Name             string                        `json:"name,omitempty"`
	Status           AutomationStatus              `json:"status,omitempty"`
	TriggerEventName string                        `json:"trigger_event_name,omitempty"`
	Steps            []AutomationStepPayload       `json:"steps"`
	Connections      []AutomationConnectionPayload `json:"connections,omitempty"`
}

// UpdateAutomationRequest is the payload for PATCH /api/automations/{id}.
type UpdateAutomationRequest struct {
	Name             string                        `json:"name,omitempty"`
	Status           AutomationStatus              `json:"status,omitempty"`
	TriggerEventName string                        `json:"trigger_event_name,omitempty"`
	Steps            []AutomationStepPayload       `json:"steps,omitempty"`
	Connections      []AutomationConnectionPayload `json:"connections,omitempty"`
}

// AutomationStepResponse is a step as returned by the API.
type AutomationStepResponse struct {
	ID       string                 `json:"id"`
	Key      string                 `json:"key"`
	Type     string                 `json:"type"`
	Config   map[string]interface{} `json:"config"`
	Position int                    `json:"position"`
}

// AutomationDetailResponse is the full automation resource.
type AutomationDetailResponse struct {
	Object           string                        `json:"object"`
	ID               string                        `json:"id"`
	Name             string                        `json:"name"`
	Status           AutomationStatus              `json:"status"`
	TriggerEventName *string                       `json:"trigger_event_name"`
	Connections      []AutomationConnectionPayload `json:"connections"`
	Steps            []AutomationStepResponse      `json:"steps"`
	CreatedAt        string                        `json:"created_at"`
	UpdatedAt        string                        `json:"updated_at"`
}

// AutomationLastRun is a summary of the most recent run.
type AutomationLastRun struct {
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// AutomationListItem is one row in the automation list.
type AutomationListItem struct {
	Object           string             `json:"object"`
	ID               string             `json:"id"`
	Name             string             `json:"name"`
	Status           AutomationStatus   `json:"status"`
	TriggerEventName *string            `json:"trigger_event_name"`
	CreatedAt        string             `json:"created_at"`
	UpdatedAt        string             `json:"updated_at"`
	StepCount        int                `json:"step_count"`
	LastRun          *AutomationLastRun `json:"last_run"`
}

// AutomationListOptions controls filtering/pagination for GET /api/automations.
type AutomationListOptions struct {
	Limit  *int
	After  string
	Status string
}

// AutomationListResponse is returned by GET /api/automations.
type AutomationListResponse struct {
	Object  string               `json:"object"`
	Data    []AutomationListItem `json:"data"`
	HasMore bool                 `json:"has_more"`
}

// AutomationDeleteResponse is returned by DELETE /api/automations/{id}.
type AutomationDeleteResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// AutomationRunListOptions controls filtering/pagination for run lists.
type AutomationRunListOptions struct {
	Limit  *int
	After  string
	Status string
}

// AutomationRunListItem is one run in the run list.
type AutomationRunListItem struct {
	Object          string              `json:"object"`
	ID              string              `json:"id"`
	AutomationID    string              `json:"automation_id"`
	Status          AutomationRunStatus `json:"status"`
	StartedAt       *string             `json:"started_at"`
	CompletedAt     *string             `json:"completed_at"`
	DurationMS      *int64              `json:"duration_ms"`
	CurrentStepKey  *string             `json:"current_step_key"`
	FailedStepKey   *string             `json:"failed_step_key"`
	FailureReason   *string             `json:"failure_reason"`
	NextStepAt      *string             `json:"next_step_at"`
	CreatedAt       string              `json:"created_at"`
	UpdatedAt       string              `json:"updated_at"`
}

// AutomationRunStepState is the per-step execution state.
type AutomationRunStepState struct {
	Status       string                 `json:"status"`
	StartedAt    *string                `json:"startedAt,omitempty"`
	CompletedAt  *string                `json:"completedAt,omitempty"`
	ScheduledFor *string                `json:"scheduledFor,omitempty"`
	Error        *string                `json:"error,omitempty"`
	Output       map[string]interface{} `json:"output,omitempty"`
}

// AutomationRunDetailItem extends AutomationRunListItem with step states.
type AutomationRunDetailItem struct {
	AutomationRunListItem
	TriggerEventID *string                            `json:"trigger_event_id"`
	ContactID      *string                            `json:"contact_id"`
	StepStates     map[string]AutomationRunStepState  `json:"step_states"`
}

// AutomationRunListResponse is returned by GET /api/automations/{id}/runs.
type AutomationRunListResponse struct {
	Object  string                  `json:"object"`
	Data    []AutomationRunListItem `json:"data"`
	HasMore bool                    `json:"has_more"`
}

// CancelAutomationRunRequest is the payload for POST /api/automations/{id}/runs/{runId}/cancel.
type CancelAutomationRunRequest struct {
	Reason string `json:"reason,omitempty"`
}

// AutomationRunMetricsOptions controls date-range filtering for run metrics.
type AutomationRunMetricsOptions struct {
	From string
	To   string
}

// AutomationRunMetricsFailedStep counts failures on a specific step.
type AutomationRunMetricsFailedStep struct {
	StepKey string `json:"step_key"`
	Count   int    `json:"count"`
}

// AutomationRunMetricsRange is the date range a metrics response covers.
type AutomationRunMetricsRange struct {
	From *string `json:"from"`
	To   *string `json:"to"`
}

// AutomationRunMetricsResponse is returned by GET /api/automations/{id}/runs/metrics.
type AutomationRunMetricsResponse struct {
	Object            string                           `json:"object"`
	AutomationID      string                           `json:"automation_id"`
	TotalRuns         int                              `json:"total_runs"`
	ByStatus          map[string]int                   `json:"by_status"`
	CompletionRate    float64                          `json:"completion_rate"`
	FailureRate       float64                          `json:"failure_rate"`
	AverageDurationMS *float64                         `json:"average_duration_ms"`
	WaitingCount      int                              `json:"waiting_count"`
	FailedSteps       []AutomationRunMetricsFailedStep `json:"failed_steps"`
	Range             AutomationRunMetricsRange        `json:"range"`
}

// ---------------------------------------------------------------------------
// Custom event types
// ---------------------------------------------------------------------------

// CreateEventRequest is the payload for POST /api/events.
type CreateEventRequest struct {
	Name   string                 `json:"name"`
	Schema map[string]interface{} `json:"schema,omitempty"`
}

// CustomEvent is the event definition resource.
type CustomEvent struct {
	Object    string                 `json:"object"`
	ID        string                 `json:"id"`
	Name      string                 `json:"name"`
	Schema    map[string]interface{} `json:"schema"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

// CustomEventListResponse is returned by GET /api/events.
type CustomEventListResponse struct {
	Object  string        `json:"object"`
	Data    []CustomEvent `json:"data"`
	HasMore bool          `json:"has_more"`
}

// SendEventRequest is the payload for POST /api/events/send.
type SendEventRequest struct {
	Event     string                 `json:"event"`
	ContactID string                 `json:"contact_id,omitempty"`
	Email     string                 `json:"email,omitempty"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
}

// CustomEventDelivery is a delivery record for a sent event.
type CustomEventDelivery struct {
	Object     string                 `json:"object"`
	ID         string                 `json:"id"`
	Event      string                 `json:"event"`
	ContactID  *string                `json:"contact_id"`
	Email      *string                `json:"email"`
	Payload    map[string]interface{} `json:"payload"`
	ReceivedAt string                 `json:"received_at"`
}

// SendCustomEventResponse is returned by POST /api/events/send.
type SendCustomEventResponse struct {
	Object        string                  `json:"object"`
	Delivery      CustomEventDelivery     `json:"delivery"`
	ResumedRuns   []AutomationRunListItem `json:"resumed_runs"`
	AutomationRuns []AutomationRunListItem `json:"automation_runs"`
}

// ---------------------------------------------------------------------------
// Webhook types
// ---------------------------------------------------------------------------

// WebhookStatus enumerates webhook states.
type WebhookStatus = string

const (
	WebhookStatusEnabled  WebhookStatus = "enabled"
	WebhookStatusDisabled WebhookStatus = "disabled"
)

// CreateWebhookRequest is the payload for POST /api/webhooks.
type CreateWebhookRequest struct {
	Endpoint   string   `json:"endpoint,omitempty"`
	URL        string   `json:"url,omitempty"`
	Events     []string `json:"events,omitempty"`
	EventTypes []string `json:"event_types,omitempty"`
}

// UpdateWebhookRequest is the payload for PATCH /api/webhooks/{id}.
type UpdateWebhookRequest struct {
	Endpoint   string        `json:"endpoint,omitempty"`
	URL        string        `json:"url,omitempty"`
	Events     []string      `json:"events,omitempty"`
	EventTypes []string      `json:"event_types,omitempty"`
	Status     WebhookStatus `json:"status,omitempty"`
	Active     *bool         `json:"active,omitempty"`
}

// WebhookListOptions controls pagination for GET /api/webhooks.
type WebhookListOptions struct {
	Limit *int
	After string
}

// WebhookDeliveryItem is one delivery attempt record.
type WebhookDeliveryItem struct {
	ID           string  `json:"id"`
	Status       string  `json:"status"`
	Attempt      int     `json:"attempt"`
	StatusCode   *int    `json:"status_code"`
	ResponseBody *string `json:"response_body"`
	AttemptedAt  *string `json:"attempted_at"`
	NextRetryAt  *string `json:"next_retry_at"`
	CreatedAt    string  `json:"created_at"`
}

// WebhookListItem is one row in the webhook list.
type WebhookListItem struct {
	ID        string        `json:"id"`
	Endpoint  string        `json:"endpoint"`
	Events    []string      `json:"events"`
	Status    WebhookStatus `json:"status"`
	CreatedAt string        `json:"created_at"`
}

// WebhookListResponse is returned by GET /api/webhooks.
type WebhookListResponse struct {
	Object  string            `json:"object"`
	Data    []WebhookListItem `json:"data"`
	HasMore bool              `json:"has_more"`
}

// WebhookCreateResponse is returned by POST /api/webhooks (includes signing_secret).
type WebhookCreateResponse struct {
	WebhookListItem
	Object        string `json:"object"`
	SigningSecret string `json:"signing_secret"`
}

// WebhookDetailResponse is returned by GET /api/webhooks/{id}.
type WebhookDetailResponse struct {
	WebhookListItem
	Object           string                `json:"object"`
	RecentDeliveries []WebhookDeliveryItem `json:"recent_deliveries"`
}

// WebhookUpdateResponse is returned by PATCH /api/webhooks/{id}.
type WebhookUpdateResponse struct {
	WebhookListItem
	Object string `json:"object"`
}

// DeleteWebhookResponse is returned by DELETE /api/webhooks/{id}.
type DeleteWebhookResponse struct {
	Object  string `json:"object"`
	ID      string `json:"id"`
	Deleted bool   `json:"deleted"`
}

// WebhookDeliveryListResponse is returned by GET /api/webhooks/{id}/deliveries.
type WebhookDeliveryListResponse struct {
	Object  string                `json:"object"`
	Data    []WebhookDeliveryItem `json:"data"`
	HasMore bool                  `json:"has_more"`
}

// WebhookDeliveryReplayResponse is returned by POST /api/webhooks/{id}/deliveries/{deliveryId}/replay.
type WebhookDeliveryReplayResponse struct {
	Object           string              `json:"object"`
	OriginalDelivery WebhookDeliveryItem `json:"original_delivery"`
	ReplayDelivery   WebhookDeliveryItem `json:"replay_delivery"`
}

// ---------------------------------------------------------------------------
// Topic types
// ---------------------------------------------------------------------------

// TopicDefaultSubscription enumerates the default subscription behaviour.
type TopicDefaultSubscription = string

const (
	TopicDefaultSubscriptionOptIn  TopicDefaultSubscription = "opt_in"
	TopicDefaultSubscriptionOptOut TopicDefaultSubscription = "opt_out"
)

// TopicVisibility enumerates topic visibility modes.
type TopicVisibility = string

const (
	TopicVisibilityPublic  TopicVisibility = "public"
	TopicVisibilityPrivate TopicVisibility = "private"
)

// CreateTopicRequest is the payload for POST /api/topics.
type CreateTopicRequest struct {
	Name                string                  `json:"name"`
	Description         *string                 `json:"description,omitempty"`
	DefaultSubscription TopicDefaultSubscription `json:"default_subscription,omitempty"`
	Visibility          TopicVisibility         `json:"visibility,omitempty"`
}

// UpdateTopicRequest is the payload for PATCH /api/topics/{id}.
type UpdateTopicRequest struct {
	Name                string                  `json:"name,omitempty"`
	Description         *string                 `json:"description,omitempty"`
	DefaultSubscription TopicDefaultSubscription `json:"default_subscription,omitempty"`
	Visibility          TopicVisibility         `json:"visibility,omitempty"`
}

// TopicListOptions controls filtering/pagination for GET /api/topics.
type TopicListOptions struct {
	Limit  *int
	After  string
	Search string
}

// TopicListItem is one row in the topic list.
type TopicListItem struct {
	ID                  string                  `json:"id"`
	Name                string                  `json:"name"`
	Description         *string                 `json:"description"`
	DefaultSubscription TopicDefaultSubscription `json:"default_subscription"`
	Visibility          TopicVisibility         `json:"visibility"`
	CreatedAt           string                  `json:"created_at"`
}

// TopicListResponse is returned by GET /api/topics.
type TopicListResponse struct {
	Object  string          `json:"object"`
	Data    []TopicListItem `json:"data"`
	HasMore bool            `json:"has_more"`
	Total   *int            `json:"total,omitempty"`
}

// TopicResponse is the full topic resource.
type TopicResponse struct {
	Object              string                  `json:"object"`
	ID                  string                  `json:"id"`
	Name                string                  `json:"name"`
	Description         *string                 `json:"description"`
	DefaultSubscription TopicDefaultSubscription `json:"default_subscription"`
	Visibility          TopicVisibility         `json:"visibility"`
	CreatedAt           string                  `json:"created_at"`
}

// CreateTopicResponse matches the server response for POST /api/topics (camelCase fields).
type CreateTopicResponse struct {
	Object              string                  `json:"object"`
	ID                  string                  `json:"id"`
	Name                string                  `json:"name"`
	Description         *string                 `json:"description"`
	DefaultSubscription TopicDefaultSubscription `json:"defaultSubscription"`
	Visibility          TopicVisibility         `json:"visibility"`
	CreatedAt           string                  `json:"createdAt"`
}

// DeleteTopicResponse is returned by DELETE /api/topics/{id}.
type DeleteTopicResponse struct {
	Success bool `json:"success"`
}

// ---------------------------------------------------------------------------
// Suppression types
// ---------------------------------------------------------------------------

// SuppressionReason enumerates suppression causes.
type SuppressionReason = string

const (
	SuppressionReasonBounce      SuppressionReason = "bounce"
	SuppressionReasonComplaint   SuppressionReason = "complaint"
	SuppressionReasonManual      SuppressionReason = "manual"
	SuppressionReasonUnsubscribe SuppressionReason = "unsubscribe"
)

// SuppressionPublicItem is a single suppression record.
type SuppressionPublicItem struct {
	ID             string                 `json:"id"`
	Object         string                 `json:"object"`
	Email          string                 `json:"email"`
	Reason         SuppressionReason      `json:"reason"`
	Scope          string                 `json:"scope"`
	SourceEventID  *string                `json:"source_event_id"`
	SourceEmailID  *string                `json:"source_email_id"`
	SourceMessageID *string               `json:"source_message_id"`
	Metadata       map[string]interface{} `json:"metadata"`
	SuppressedAt   string                 `json:"suppressed_at"`
	UpdatedAt      string                 `json:"updated_at"`
}

// SuppressionListOptions controls pagination for GET /api/suppressions.
type SuppressionListOptions struct {
	Limit *int
	After string
}

// SuppressionListResponse is returned by GET /api/suppressions.
type SuppressionListResponse struct {
	Object  string                  `json:"object"`
	Scope   string                  `json:"scope"`
	Data    []SuppressionPublicItem `json:"data"`
	HasMore bool                    `json:"has_more"`
}

// CreateSuppressionRequest is the payload for POST /api/suppressions.
type CreateSuppressionRequest struct {
	Email  string            `json:"email"`
	Reason SuppressionReason `json:"reason,omitempty"`
}

// DeleteSuppressionResponse is returned by DELETE /api/suppressions/{email}.
type DeleteSuppressionResponse struct {
	Object  string `json:"object"`
	Deleted bool   `json:"deleted"`
}

// ---------------------------------------------------------------------------
// Log types
// ---------------------------------------------------------------------------

// LogListOptions controls filtering/pagination for GET /api/logs.
type LogListOptions struct {
	Limit    *int
	After    string
	Before   string
	Status   string
	Method   string
	APIKeyID string
	DateFrom string
	DateTo   string
	UserAgent string
	Search   string
}

// LogListItem is one row in the log list.
type LogListItem struct {
	ID             string  `json:"id"`
	Method         *string `json:"method"`
	Endpoint       *string `json:"endpoint"`
	ResponseStatus *int    `json:"response_status"`
	UserAgent      *string `json:"user_agent"`
	APIKeyID       *string `json:"api_key_id"`
	CreatedAt      string  `json:"created_at"`
}

// LogListResponse is returned by GET /api/logs.
type LogListResponse struct {
	Object  string        `json:"object"`
	Data    []LogListItem `json:"data"`
	HasMore bool          `json:"has_more"`
}

// LogDetailResponse is returned by GET /api/logs/{id}.
type LogDetailResponse struct {
	Object       string      `json:"object"`
	ID           string      `json:"id"`
	Method       *string     `json:"method"`
	Endpoint     *string     `json:"endpoint"`
	Status       *int        `json:"status"`
	UserAgent    *string     `json:"user_agent"`
	APIKeyID     *string     `json:"api_key_id"`
	RequestBody  interface{} `json:"request_body"`
	ResponseBody interface{} `json:"response_body"`
	CreatedAt    string      `json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request options (idempotency)
// ---------------------------------------------------------------------------

// RequestOptions carries optional per-request controls.
type RequestOptions struct {
	// IdempotencyKey, when set, is sent as the Idempotency-Key header.
	IdempotencyKey string
}
