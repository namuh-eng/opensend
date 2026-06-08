# Integrations

OpenSend currently ships one app connector: the webhook / Zapier-style outbound
connector. No other app catalog entries are supported until they have a real
connection flow in the dashboard and API.

## Webhook / Zapier connector

Use the webhook connector when you want OpenSend to send a signed test event to
an automation URL such as a Zapier Catch Hook, Make webhook, or another HTTPS
workflow endpoint.

### Configure in the dashboard

1. Open **Integrations**.
2. Choose **Webhook / Zapier**.
3. Enter the webhook URL from your automation tool.
4. Optionally enter a signing secret if the receiving workflow verifies
   `x-opensend-signature`.
5. Save the connector, then click **Send test event**.

The dashboard shows installed/uninstalled state, health, last event time, and a
redacted endpoint preview. The full webhook URL and signing secret are encrypted
at rest and are not shown again after save.

### API endpoints

The connector uses dashboard session auth or a full-access API key.

- `GET /api/integrations` — list the shipped integration catalog.
- `GET /api/integrations/webhook` — retrieve the webhook connector connection.
- `POST /api/integrations/webhook` — connect the webhook connector.
- `PATCH /api/integrations/connections/{id}` — update name, URL, or signing
  secret.
- `DELETE /api/integrations/connections/{id}` — disconnect the connector.
- `POST /api/integrations/connections/{id}/test` — send a test event.

Create request:

```json
{
  "name": "Zapier catch hook",
  "webhook_url": "https://hooks.zapier.com/hooks/catch/123/abc",
  "signing_secret": "optional-shared-secret"
}
```

Responses never include the raw webhook URL or signing secret. They include a
redacted endpoint preview, connection state, scopes, health, and timestamps.

### Test event

OpenSend sends this JSON body to the configured URL:

```json
{
  "type": "integration.test",
  "created_at": "2026-06-06T00:00:00.000Z",
  "data": {
    "provider": "webhook",
    "connection_id": "uuid",
    "connection_name": "Zapier catch hook"
  }
}
```

When a signing secret is configured, OpenSend also sends:

- `x-opensend-timestamp` — Unix timestamp.
- `x-opensend-signature` — HMAC-SHA256 over
  `<timestamp>.<raw-json-body>`.

## Self-hosted secret configuration

Set `INTEGRATION_SECRET_ENCRYPTION_KEY` in the app environment to encrypt
connector credentials. The value can be a 32-byte base64 key, a 64-character hex
key, or high-entropy key material of at least 16 characters. In small self-hosted
development installs, OpenSend falls back to `WEBHOOK_SECRET_ENCRYPTION_KEY` if
the integration-specific key is not set, but production deployments should set a
dedicated integration key through a secrets manager.
