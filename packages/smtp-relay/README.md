# @opensend/smtp-relay

A standalone SMTP server that accepts mail from any application that can send
via SMTP, authenticates the connection with an OpenSend API key, parses the
MIME message, and injects it into the OpenSend send pipeline — the same path
the REST API uses. Quota tracking, suppression checks, tracking, and webhooks
all apply automatically.

## AUTH model

| Field    | Value                                       |
|----------|---------------------------------------------|
| Host     | your relay host                             |
| Port     | `2587` (default, configurable)              |
| Security | STARTTLS (when TLS certs are configured)    |
| Username | `apikey` (any non-empty string is accepted) |
| Password | your OpenSend API key, e.g. `os_live_...`   |

The password is the only value used for authentication. The username field is
ignored and exists solely because most SMTP clients require a non-empty value.

## Environment variables

| Variable                          | Required | Default     | Description                                      |
|-----------------------------------|----------|-------------|--------------------------------------------------|
| `DATABASE_URL`                    | yes      | —           | Postgres connection string                        |
| `SMTP_RELAY_PORT`                 | no       | `2587`      | TCP port to listen on                            |
| `SMTP_RELAY_HOST`                 | no       | `0.0.0.0`   | Bind address                                     |
| `SMTP_RELAY_TLS_CERT_PATH`        | no       | —           | Path to PEM certificate; enables STARTTLS        |
| `SMTP_RELAY_TLS_KEY_PATH`         | no       | —           | Path to PEM private key                          |
| `SMTP_RELAY_MAX_MESSAGE_SIZE_BYTES` | no     | `41943040`  | Max message size in bytes (default 40 MB)        |
| `BACKGROUND_JOBS_QUEUE_URL`       | no       | —           | SQS queue URL for async delivery                 |
| `AWS_REGION`                      | no       | `us-east-1` | AWS region for SQS/SES                           |

## Running locally

```bash
DATABASE_URL=postgres://... bun packages/smtp-relay/src/index.ts
```

## Running with Docker

The repository `docker-compose.yml` exposes the relay behind the explicit
`smtp` profile so it does not run in the default stack:

```bash
docker compose --profile smtp up -d smtp-relay
```

Set `SMTP_RELAY_PORT` to change the published/listen port. Configure TLS paths
only when the referenced certificate/key files are mounted into the relay
container. Accepted SMTP messages only enter the normal delivery worker path
when `BACKGROUND_JOBS_QUEUE_URL` is configured. In default Docker Compose,
the ingester DB-polling fallback dispatches accepted rows when SQS is absent;
for production scale, configure SQS and keep `BACKGROUND_WORKER_POLL=true`.

For a standalone image:

```bash
docker build \
  --platform linux/amd64 \
  -f packages/smtp-relay/Dockerfile \
  -t opensend-smtp-relay .

docker run --rm \
  -e DATABASE_URL=postgres://... \
  -e BACKGROUND_JOBS_QUEUE_URL=https://sqs... \
  -p 2587:2587 \
  opensend-smtp-relay
```

## Pointing an application at the relay

Use your application's SMTP configuration:

```
Host:     <relay-host>
Port:     2587
Security: STARTTLS (or None if TLS not configured)
Username: apikey
Password: os_live_xxxxxxxxxxxx   (your OpenSend API key)
```

## What happens on send

1. AUTH LOGIN/PLAIN — password is hashed and looked up in the DB.
2. DATA — MIME message is parsed; From/To/Cc/Bcc/Subject/Html/Text/
   headers/attachments are extracted.
3. Domain restriction — if the API key is domain-restricted, the From domain
   must match.
4. Suppression check — any suppressed `To` recipients trigger a 5xx rejection.
5. DB row created with `status: queued`.
6. SQS send job published → queue worker delivers via SES.

SMTP response codes:
- `250 OK` — message accepted and queued
- `535` — authentication failure (invalid API key)
- `550` — rejected (suppressed recipient, domain mismatch, missing From/To)
- `552` — message too large (attachments exceed 40 MB)
- `500` — internal error
