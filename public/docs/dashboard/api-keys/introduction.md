# Dashboard API Keys

API keys authenticate server-to-server access to the OpenSend API. Use the dashboard to create, list, inspect, restrict, and revoke keys.

## Best practices

- Create separate keys for production, staging, local development, and CI.
- Restrict keys to a sending domain when the integration should only use one domain.
- Store the token immediately; full token material is shown only at creation time.
- Rotate keys on employee offboarding, incident response, or deployment leaks.
- Never place an API key in browser code or mobile app bundles.

## Troubleshooting

A 401 usually means the token is missing, malformed, revoked, or unknown. A 403 can mean the key lacks permission or is restricted to a different domain.
