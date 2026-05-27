# Send emails with Flask

Use the Python SDK from Flask routes, CLI commands, or background workers.

## Install

```bash
python -m pip install flask
python -m pip install ./packages/python-sdk
```

After the Python package is published, replace the local install with `python -m pip install opensend`.

## Example

```python
import os
from flask import Flask, jsonify, request
from opensend import OpenSend

app = Flask(__name__)
client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL"),
)

@app.post("/send")
def send_email():
    payload = request.get_json(silent=True) or {}
    email_address = payload.get("email")
    if not email_address:
        return jsonify({"error": "email is required"}), 400

    email = client.emails.send({
        "from": "OpenSend <onboarding@updates.example.com>",
        "to": email_address,
        "subject": "Hello from Flask",
        "html": "<p>Flask queued this email.</p>",
    })

    return jsonify({"id": email["id"]})
```

## Notes

- Keep `OPENSEND_API_KEY` in environment variables or your platform secret manager.
- For Celery/RQ jobs, create the client once per worker process.
- Use `idempotency_key` for retrying jobs.
