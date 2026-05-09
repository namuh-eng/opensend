# Go ingester service (experimental)

`services/ingester-go` is a standard-library Go skeleton for the planned OpenSend data-plane migration tracked by issue #71.

Current status: **experimental / shadow-only**. The production ingester remains the Bun/Hono service in `packages/ingester` on port `3016`. Do not point SES SNS topics, Stripe webhooks, scheduled jobs, or production traffic at this Go service yet.

## Local defaults

- `HOST` defaults to `0.0.0.0`
- `PORT` defaults to `3027`, matching the #71 local port plan for the future Go ingester cutover

## Endpoints

- `GET /health` returns static service health JSON
- `GET /readyz` returns static readiness JSON and does not check Postgres, AWS, SQS, SES, SNS, or webhook dispatcher dependencies

## Development

```bash
cd services/ingester-go
go test ./...
go run .
```

The service listens on `http://localhost:3027` by default when run locally with the default host/port.

## Container build

From the repository root:

```bash
docker build -f services/ingester-go/Dockerfile -t opensend-ingester-go:dev .
```

This image is for local/shadow validation only. Future parity slices must explicitly port SES/SNS parsing, queue polling, scheduled-email processing, and webhook fan-out before any production cutover.
