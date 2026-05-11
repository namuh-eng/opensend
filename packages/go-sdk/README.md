# opensend Go SDK

Minimal first-party Go SDK for OpenSend transactional email sends with a
Resend-shaped first send surface.

## Installation

From a Go module, install the package from this repository:

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk
```

## Setup

Use environment variables instead of hardcoding API keys:

```bash
export OPENSEND_API_KEY="os_your_api_key"
```

For self-hosted OpenSend, point the SDK at your deployment origin. The default
hosted origin is `https://api.opensend.com`.

```bash
export OPENSEND_BASE_URL="http://localhost:3026"
```

## Send an email

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
	options := []opensend.Option{}
	if baseURL := os.Getenv("OPENSEND_BASE_URL"); baseURL != "" {
		options = append(options, opensend.WithBaseURL(baseURL))
	}

	client, err := opensend.NewClient(os.Getenv("OPENSEND_API_KEY"), options...)
	if err != nil {
		log.Fatal(err)
	}

	email, err := client.Send(context.Background(), opensend.SendRequest{
		From:    "hello@yourdomain.com",
		To:      []string{"recipient@example.com"},
		Subject: "Hello from OpenSend",
		HTML:    "<h1>It works!</h1>",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(email.ID)
}
```

`Send` posts to OpenSend's Resend-compatible `POST /emails` endpoint and returns
the accepted email id.

## Custom HTTP client

```go
httpClient := &http.Client{Timeout: 10 * time.Second}
client, err := opensend.NewClient(
	os.Getenv("OPENSEND_API_KEY"),
	opensend.WithHTTPClient(httpClient),
)
```

## Errors

Non-2xx API responses return `*opensend.APIError`. The error keeps the HTTP
status and raw response body so callers can branch on validation/auth failures.
When OpenSend returns its public error envelope, `Name`, `Code`, `Message`, and
`Details` are populated too.

```go
email, err := client.Send(ctx, params)
if err != nil {
	var apiErr *opensend.APIError
	if errors.As(err, &apiErr) {
		fmt.Println(apiErr.StatusCode, apiErr.Code, apiErr.Body)
		return
	}
	return
}
fmt.Println(email.ID)
```

## Supported first slice

- `client.Send(ctx, opensend.SendRequest{...})` → `POST /emails`
- Bearer API key auth
- Configurable base URL
- Optional custom `*http.Client`
- Typed request fields for `from`, `to`, `subject`, `html`, `text`, `cc`, `bcc`, and `reply_to`

This first package intentionally does not implement attachments, templates,
audiences, domains, framework examples, provider infrastructure, or the full
Resend resource surface yet.

## Tests

```bash
cd packages/go-sdk
go test ./...
```
