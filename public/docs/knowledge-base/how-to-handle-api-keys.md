# How to handle API keys

API keys are bearer credentials. Anyone with a valid key can call the OpenSend API within that key's permissions and restrictions.

## Storage

- Store keys in a server-side secret manager or environment variable.
- Never commit keys to git.
- Never expose keys in browser bundles, mobile apps, logs, analytics, or support screenshots.
- Use separate keys for local, staging, CI, and production.

## Rotation

Create a new key, deploy it, confirm traffic is using it, then revoke the old key. Rotate immediately after an employee offboards, a repository leak, or a suspicious support incident.

## Restrictions

Use domain-restricted keys when an integration should only send from one domain. Keep high-privilege management keys out of application runtime code when a narrower sending key is enough.

## Incident response

If a key leaks, revoke it first. Then inspect logs for unusual sends, new domains, API key changes, broadcast activity, and suppression changes.
