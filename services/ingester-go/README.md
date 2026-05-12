# Go ingester service (experimental)

`services/ingester-go` is a standard-library Go skeleton for the planned OpenSend data-plane migration tracked by issue #71.

Current status: **experimental / shadow-only**. The production ingester remains the Bun/Hono service in `packages/ingester` on port `3016`. Do not point SES SNS topics, Stripe webhooks, scheduled jobs, or production traffic at this Go service yet.

## Local defaults

- `HOST` defaults to `0.0.0.0`
- `PORT` defaults to `3027`, matching the #71 local port plan for the future Go ingester cutover

## Endpoints

- `GET /health` returns static service health JSON
- `GET /readyz` returns static readiness JSON and does not check Postgres, AWS, SQS, SES, SNS, or webhook dispatcher dependencies

## Webhook signing parity

The `internal/webhooksigning` package mirrors the current TypeScript dispatcher signing behavior without wiring the Go service into delivery dispatch. It builds the three Svix-compatible delivery headers used by `packages/ingester/src/dispatcher.ts`:

- `svix-id`
- `svix-timestamp`
- `svix-signature`

The signature formula intentionally matches `packages/core/src/webhook-signing.ts`:

```text
v1,base64(hmac_sha256(secret.replace("whsec_", ""), svix-id + "." + svix-timestamp + "." + raw_json_body))
```

The Go tests include deterministic fixtures generated from the TypeScript helper so future migration slices can confirm parity before adding real dispatch, persistence, retries, or infrastructure wiring.

## Development

```bash
cd services/ingester-go
go test ./...
go run .
```

Run the webhook-signing parity tests directly with:

```bash
cd services/ingester-go
go test ./internal/webhooksigning
```

The service listens on `http://localhost:3027` by default when run locally with the default host/port.

## Container build

From the repository root:

```bash
docker build -f services/ingester-go/Dockerfile -t opensend-ingester-go:dev .
```

This image is for local/shadow validation only. Future parity slices must explicitly port SES/SNS parsing, queue polling, scheduled-email processing, webhook fan-out, retry handling, and production deployment ownership before any cutover.
