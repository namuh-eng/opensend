# opensend Go SDK

First-party Go SDK for [OpenSend](https://opensend.namuh.co) — the open-source,
self-hostable email platform. Covers the full REST API surface: emails,
domains, API keys, contacts, segments, audiences, broadcasts, templates,
automations, custom events, webhooks, topics, suppressions, and logs.

## Installation

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.2.0
```

## Setup

Use environment variables instead of hardcoding API keys:

```bash
export OPENSEND_API_KEY="os_your_api_key"
```

For self-hosted deployments, point the SDK at your origin (default:
`https://opensend.namuh.co`):

```bash
export OPENSEND_BASE_URL="https://mail.yourcompany.com"
```

## Quick start

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    opensend "github.com/namuh-eng/opensend/packages/go-sdk"
)

func main() {
    var opts []opensend.Option
    if u := os.Getenv("OPENSEND_BASE_URL"); u != "" {
        opts = append(opts, opensend.WithBaseURL(u))
    }

    client, err := opensend.NewClient(os.Getenv("OPENSEND_API_KEY"), opts...)
    if err != nil {
        log.Fatal(err)
    }

    // Send a transactional email
    resp, err := client.Emails.Send(context.Background(), opensend.SendEmailRequest{
        From:    "hello@yourdomain.com",
        To:      []string{"recipient@example.com"},
        Subject: "Hello from OpenSend",
        HTML:    "<h1>It works!</h1>",
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println("sent:", resp.ID)
}
```

The top-level `client.Send` shorthand remains for backward compatibility.

## API namespaces

Every namespace is a struct field on `*Client`. Methods accept a
`context.Context` as the first argument and return `(*T, error)`.

### Emails — `client.Emails`

```go
// Send a single email (with optional idempotency)
resp, err := client.Emails.Send(ctx, opensend.SendEmailRequest{
    From: "hello@example.com", To: []string{"you@example.com"},
    Subject: "Hi", HTML: "<p>Hello</p>",
    Attachments: []opensend.EmailAttachment{{Filename: "invoice.pdf", Path: "https://..."}},
    Tags: []opensend.EmailTag{{Name: "campaign", Value: "q4"}},
}, opensend.RequestOptions{IdempotencyKey: "my-unique-key"})

// Batch send
batch, err := client.Emails.SendBatch(ctx, []opensend.SendEmailRequest{ ... })

// List, get, cancel
list, err := client.Emails.List(ctx, opensend.EmailListOptions{Limit: intPtr(20), Status: "sent"})
detail, err := client.Emails.Get(ctx, "email_id")
cancel, err := client.Emails.Cancel(ctx, "email_id")
```

### Domains — `client.Domains`

```go
domain, err := client.Domains.Create(ctx, opensend.CreateDomainRequest{Name: "mail.example.com"})
list,   err := client.Domains.List(ctx)
domain, err := client.Domains.Get(ctx, "dom_id")
update, err := client.Domains.Update(ctx, "dom_id", opensend.UpdateDomainRequest{OpenTracking: boolPtr(true)})
verify, err := client.Domains.Verify(ctx, "dom_id")
del,    err := client.Domains.Delete(ctx, "dom_id")
```

### API Keys — `client.APIKeys`

```go
key,  err := client.APIKeys.Create(ctx, opensend.CreateAPIKeyRequest{Name: "CI key", Permission: "sending_access"})
list, err := client.APIKeys.List(ctx)
err        = client.APIKeys.Delete(ctx, "key_id")
```

### Contacts — `client.Contacts`

```go
con,  err := client.Contacts.Create(ctx, opensend.CreateContactRequest{Email: "user@example.com"})
list, err := client.Contacts.List(ctx, opensend.ListOptions{Limit: intPtr(50)})
con,  err := client.Contacts.Get(ctx, "con_id")
con,  err := client.Contacts.Update(ctx, "con_id", opensend.UpdateContactRequest{FirstName: "Alice"})
del,  err := client.Contacts.Delete(ctx, "con_id")
```

### Segments — `client.Segments`

```go
seg,     err := client.Segments.Create(ctx, opensend.CreateSegmentRequest{Name: "VIPs"})
list,    err := client.Segments.List(ctx, opensend.SegmentListOptions{Search: "vip"})
seg,     err := client.Segments.Get(ctx, "seg_id")
del,     err := client.Segments.Delete(ctx, "seg_id")
members, err := client.Segments.ListContacts(ctx, "seg_id", opensend.ListOptions{})
```

### Audiences — `client.Audiences`

```go
aud,  err := client.Audiences.Create(ctx, opensend.CreateAudienceRequest{Name: "Newsletter"})
list, err := client.Audiences.List(ctx, opensend.AudienceListOptions{})
aud,  err := client.Audiences.Get(ctx, "aud_id")
del,  err := client.Audiences.Delete(ctx, "aud_id")
```

### Broadcasts — `client.Broadcasts`

```go
// Create (with optional idempotency key)
bc, err := client.Broadcasts.Create(ctx, opensend.CreateBroadcastRequest{
    From: "news@example.com", Subject: "Monthly digest", Name: "April digest",
    SegmentID: "seg_id", HTML: "<p>Content</p>",
}, opensend.RequestOptions{IdempotencyKey: "april-digest-2024"})

list, err := client.Broadcasts.List(ctx, opensend.BroadcastListOptions{Status: "sent"})
bc,   err := client.Broadcasts.Get(ctx, "bc_id")
bc,   err := client.Broadcasts.Update(ctx, "bc_id", opensend.UpdateBroadcastRequest{Subject: "Updated subject"})
del,  err := client.Broadcasts.Delete(ctx, "bc_id")

// Send immediately or schedule
sent, err := client.Broadcasts.Send(ctx, "bc_id", opensend.SendBroadcastRequest{
    ScheduledAt: "2024-06-01T09:00:00Z",
}, opensend.RequestOptions{IdempotencyKey: "send-april-digest"})
```

### Templates — `client.Templates`

```go
tpl,  err := client.Templates.Create(ctx, opensend.CreateTemplateRequest{Name: "Welcome email", HTML: "<p>Hi {{name}}</p>"})
list, err := client.Templates.List(ctx, opensend.TemplateListOptions{Status: "published"})
tpl,  err := client.Templates.Get(ctx, "tpl_id_or_alias")
tpl,  err := client.Templates.Update(ctx, "tpl_id", opensend.UpdateTemplateRequest{HTML: "<p>Updated</p>"})
del,  err := client.Templates.Delete(ctx, "tpl_id")
pub,  err := client.Templates.Publish(ctx, "tpl_id")
dup,  err := client.Templates.Duplicate(ctx, "tpl_id")
```

### Automations — `client.Automations`

```go
auto, err := client.Automations.Create(ctx, opensend.CreateAutomationRequest{
    Name: "Welcome flow",
    Steps: []opensend.AutomationStepPayload{
        {Key: "trigger", Type: "trigger"},
        {Key: "send_welcome", Type: "send_email", Config: map[string]interface{}{"template_id": "tpl_123"}},
        {Key: "end", Type: "end"},
    },
    Connections: []opensend.AutomationConnectionPayload{
        {From: "trigger", To: "send_welcome"},
        {From: "send_welcome", To: "end"},
    },
})

list,    err := client.Automations.List(ctx, opensend.AutomationListOptions{Status: "enabled"})
auto,    err := client.Automations.Get(ctx, "auto_id")
auto,    err := client.Automations.Update(ctx, "auto_id", opensend.UpdateAutomationRequest{Status: "enabled"})
del,     err := client.Automations.Delete(ctx, "auto_id")
runs,    err := client.Automations.ListRuns(ctx, "auto_id", opensend.AutomationRunListOptions{Status: "completed"})
run,     err := client.Automations.GetRun(ctx, "auto_id", "run_id")
run,     err := client.Automations.CancelRun(ctx, "auto_id", "run_id", opensend.CancelAutomationRunRequest{Reason: "manual"})
metrics, err := client.Automations.GetRunMetrics(ctx, "auto_id", opensend.AutomationRunMetricsOptions{From: "2024-01-01"})
```

### Custom Events — `client.Events`

```go
evt,  err := client.Events.Create(ctx, opensend.CreateEventRequest{Name: "user.signed_up"})
list, err := client.Events.List(ctx, opensend.ListOptions{})
res,  err := client.Events.Send(ctx, opensend.SendEventRequest{
    Event: "user.signed_up", Email: "user@example.com",
    Payload: map[string]interface{}{"plan": "pro"},
})
```

### Webhooks — `client.Webhooks`

```go
wh,   err := client.Webhooks.Create(ctx, opensend.CreateWebhookRequest{
    Endpoint: "https://yourapp.com/hooks/opensend",
    Events:   []string{"email.sent", "email.bounced"},
})
// wh.SigningSecret — store this securely for HMAC verification

list, err := client.Webhooks.List(ctx, opensend.WebhookListOptions{})
wh,   err := client.Webhooks.Get(ctx, "wh_id")
wh,   err := client.Webhooks.Update(ctx, "wh_id", opensend.UpdateWebhookRequest{Status: "disabled"})
del,  err := client.Webhooks.Delete(ctx, "wh_id")
dels, err := client.Webhooks.ListDeliveries(ctx, "wh_id", opensend.ListOptions{})
rep,  err := client.Webhooks.ReplayDelivery(ctx, "wh_id", "delivery_id")
```

### Topics — `client.Topics`

```go
topic, err := client.Topics.Create(ctx, opensend.CreateTopicRequest{
    Name: "Product updates", DefaultSubscription: "opt_in", Visibility: "public",
})
list,  err := client.Topics.List(ctx, opensend.TopicListOptions{Search: "product"})
topic, err := client.Topics.Get(ctx, "top_id")
topic, err := client.Topics.Update(ctx, "top_id", opensend.UpdateTopicRequest{Name: "Product news"})
del,   err := client.Topics.Delete(ctx, "top_id")
```

### Suppressions — `client.Suppressions`

```go
list, err := client.Suppressions.List(ctx, opensend.SuppressionListOptions{})
sup,  err := client.Suppressions.Get(ctx, "bad@example.com")   // email is URL-encoded automatically
sup,  err := client.Suppressions.Create(ctx, opensend.CreateSuppressionRequest{
    Email: "bad@example.com", Reason: "manual",
})
del,  err := client.Suppressions.Delete(ctx, "bad@example.com")
```

### Logs — `client.Logs`

```go
list, err := client.Logs.List(ctx, opensend.LogListOptions{Method: "POST", Status: "200"})
log,  err := client.Logs.Get(ctx, "log_id")
```

## Idempotency

Pass `opensend.RequestOptions{IdempotencyKey: "..."}` as the last argument to
methods that accept it: `Emails.Send`, `Emails.SendBatch`, `Broadcasts.Create`,
`Broadcasts.Send`, `Suppressions.Create`, and `Webhooks.Create`. The key is
forwarded as the `Idempotency-Key` HTTP header.

## Custom HTTP client

```go
import "net/http"
import "time"

httpClient := &http.Client{Timeout: 15 * time.Second}
client, err := opensend.NewClient(
    os.Getenv("OPENSEND_API_KEY"),
    opensend.WithHTTPClient(httpClient),
)
```

## Error handling

Non-2xx responses return `*opensend.APIError` with `StatusCode`, `Body`,
`Message`, `Name`, `Code`, and `Details` populated.

```go
_, err := client.Emails.Send(ctx, params)
if err != nil {
    var apiErr *opensend.APIError
    if errors.As(err, &apiErr) {
        fmt.Printf("status=%d code=%s message=%s\n",
            apiErr.StatusCode, apiErr.Code, apiErr.Message)
    }
    return
}
```

## Self-hosting

OpenSend is open source (ELv2). Run it yourself with Docker Compose:

```bash
git clone https://github.com/namuh-eng/opensend
cd opensend
cp .env.example .env   # fill in your secrets
docker compose up -d
```

Then point the SDK at your instance:

```go
client, _ := opensend.NewClient("os_yourkey",
    opensend.WithBaseURL("http://localhost:3015"),
)
```

## Compatibility note

`class Resend extends Opensend {}` exists in the TypeScript SDK as a
drop-in alias. The Go SDK does not expose a `Resend`-named client — use
`opensend.NewClient` directly.

## Tests

```bash
cd packages/go-sdk
go test ./...
go vet ./...
```
