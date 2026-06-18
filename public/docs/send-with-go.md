# Send emails with Go

Send email from Go with the first-party OpenSend Go SDK.

## Install

Install the tagged module version from a Go module:

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.2.0
```

## Configure

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`. Set `OPENSEND_BASE_URL` only when pointing the SDK at a self-hosted OpenSend origin.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3015" # optional for self-hosting
```

## Send one email

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
    opts := []opensend.Option{}
    if baseURL := os.Getenv("OPENSEND_BASE_URL"); baseURL != "" {
        opts = append(opts, opensend.WithBaseURL(baseURL))
    }

    client, err := opensend.NewClient(os.Getenv("OPENSEND_API_KEY"), opts...)
    if err != nil {
        log.Fatal(err)
    }

    email, err := client.Emails.Send(context.Background(), opensend.SendEmailRequest{
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

## Idempotency

```go
email, err := client.Emails.Send(
    context.Background(),
    opensend.SendEmailRequest{
        From:    "hello@yourdomain.com",
        To:      []string{"recipient@example.com"},
        Subject: "Receipt",
        HTML:    "<p>Thanks for your purchase.</p>",
    },
    opensend.RequestOptions{IdempotencyKey: "receipt-123"},
)
```

## API namespaces

The Go SDK exposes resource namespaces on `*Client`: `Emails`, `Domains`, `APIKeys`, `Contacts`, `Segments`, `Audiences`, `Broadcasts`, `Templates`, `Automations`, `Events`, `Webhooks`, `Topics`, `Suppressions`, and `Logs`. Methods accept `context.Context` first and return typed responses plus `error`.

Use the package README for exhaustive method signatures when working inside the monorepo; use `/openapi.json` for exact HTTP schemas.
