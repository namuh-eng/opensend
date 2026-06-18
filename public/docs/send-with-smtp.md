# Send email with SMTP

Send email over SMTP through the built-in OpenSend relay using an API key as the password.

OpenSend ships a built-in SMTP relay service (`@opensend/smtp-relay`) so any
application that can only send via SMTP can route mail through your OpenSend
account. The relay authenticates each connection with an OpenSend API key and
injects the message into the same delivery pipeline as the REST API —
suppression checks, click/open tracking, and webhooks all apply.

## Connection settings

| Setting  | Value                                                      |
|----------|------------------------------------------------------------|
| Host     | `smtp.yourdomain.com` (wherever you deploy the relay)      |
| Port     | `2587` (default; configurable via `SMTP_RELAY_PORT`)       |
| Security | STARTTLS (recommended; requires TLS certs on the relay)    |
| Username | `apikey` (any non-empty string works; only the password matters) |
| Password | Your OpenSend API key — e.g. `os_live_xxxxxxxxxxxx`        |

Generate an API key in the OpenSend dashboard under **Settings → API Keys**.

## How authentication works

The SMTP relay validates the **password field** only. The value must be a valid
OpenSend API key. The username field is accepted but ignored — you can set it
to `apikey`, your email address, or any non-empty string.

Both AUTH LOGIN and AUTH PLAIN are supported. Most SMTP client libraries use
one of these by default.

## Example: Nodemailer (Node.js)

```js
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: "smtp.yourdomain.com",
  port: 2587,
  secure: false,   // use STARTTLS
  auth: {
    user: "apikey",
    pass: "os_live_xxxxxxxxxxxx",
  },
});

await transport.sendMail({
  from: "hello@yourdomain.com",
  to: "recipient@example.com",
  subject: "Hello from OpenSend",
  html: "<p>Sent via SMTP relay</p>",
  text: "Sent via SMTP relay",
});
```

## Example: Python (smtplib)

```python
import smtplib
from email.mime.text import MIMEText

msg = MIMEText("Sent via SMTP relay")
msg["Subject"] = "Hello from OpenSend"
msg["From"] = "hello@yourdomain.com"
msg["To"] = "recipient@example.com"

with smtplib.SMTP("smtp.yourdomain.com", 2587) as smtp:
    smtp.starttls()
    smtp.login("apikey", "os_live_xxxxxxxxxxxx")
    smtp.send_message(msg)
```

## What happens when you send

1. **AUTH** — The relay hashes your API key and looks it up in the database.
   An invalid key receives a `535 Authentication failed` response.
2. **MIME parsing** — The raw message is parsed; From, To, Cc, Bcc, Subject,
   HTML, plain text, headers, and attachments are extracted.
3. **Domain restriction check** — If your API key is restricted to a sending
   domain, the From address must match. Violations return `550`.
4. **Suppression check** — Any To recipients on your suppression list cause
   the message to be rejected with `550`.
5. **Queued** — A database row is created with `status: queued` and a send job
   is published to the delivery queue.
6. **Delivery** — The queue worker sends via SES, exactly as REST-submitted
   emails are sent. Events, tracking, and webhooks fire normally.

## Deploying the relay

The relay is a standalone Bun service in `packages/smtp-relay/`. Run it
alongside the main app or as a separate container:

```bash
# Docker Compose profile
docker compose --profile smtp up -d smtp-relay
```

```bash
# Standalone
DATABASE_URL=postgres://... \
BACKGROUND_JOBS_QUEUE_URL=https://sqs... \
SMTP_RELAY_PORT=2587 \
bun packages/smtp-relay/src/index.ts
```

```bash
# Docker
docker build --platform linux/amd64 \
  -f packages/smtp-relay/Dockerfile \
  -t opensend-smtp-relay .

docker run --rm \
  -e DATABASE_URL=postgres://... \
  -e BACKGROUND_JOBS_QUEUE_URL=https://sqs... \
  -p 2587:2587 \
  opensend-smtp-relay
```

The Compose profile uses the same Postgres database as the app, publishes `SMTP_RELAY_PORT` (default `2587`), and is not started by default. Accepted SMTP messages only enter the normal delivery worker path when `BACKGROUND_JOBS_QUEUE_URL` is configured; without a queue URL, rows can be accepted for local evaluation but delivery is skipped until the queue contract is wired. See `packages/smtp-relay/README.md` for the full list of environment variables and STARTTLS configuration.

## Limitations

- **No SMTP `RCPT TO` envelope routing** — recipients must be encoded in the
  `To`/`Cc`/`Bcc` headers of the MIME message.
- **Attachments cap** — Total attachments must be under 40 MB after Base64
  encoding (matches the REST API limit).
- **No scheduled sending** — Use the REST API (`scheduled_at`) for deferred
  delivery.
- **No template rendering** — Pass fully-rendered HTML/text. Use the REST API
  for stored-template sends.
