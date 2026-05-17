# Go SDK

OpenSend includes a minimal first-party Go SDK package at
[`packages/go-sdk`](../../packages/go-sdk) for transactional email sends
through OpenSend's familiar email API.

Use your OpenSend API key (`os_...`) with OpenSend's familiar email API surface.

## Install

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.1.0
```

## Configure

Store API keys in environment variables; do not hardcode real keys.

```bash
export OPENSEND_API_KEY="os_your_api_key"
export OPENSEND_BASE_URL="http://localhost:3026" # optional for self-hosting
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.

## Send

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

## Errors

Non-2xx responses return `*opensend.APIError` with `StatusCode` and raw `Body`.
When the OpenSend API error envelope is present, `Name`, `Code`, `Message`, and
`Details` are populated as well.
