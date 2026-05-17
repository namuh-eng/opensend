# Send email with the OpenSend npm package

Minimal Node/Bun example for sending one email with the published `opensend` npm package.

## Run it

```bash
cd examples/npm-send-email
npm install
cp .env.example .env
# Edit .env with your OpenSend API key, verified sender, and test recipient.
npm start
```

The example reads `.env` locally for convenience. Do not commit real API keys.

## Required values

- `OPENSEND_API_KEY` — an OpenSend API key, for example `os_live_...`.
- `OPENSEND_FROM` — a sender address on a verified OpenSend domain.
- `OPENSEND_TO` — the test recipient.

`OPENSEND_BASE_URL` is optional. Leave it unset for OpenSend Cloud, or set it to your self-hosted origin such as `http://localhost:3015`.
