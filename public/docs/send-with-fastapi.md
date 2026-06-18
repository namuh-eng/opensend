# Send emails with FastAPI

Use the Python SDK from FastAPI route handlers or background tasks.

## Install

```bash
python -m pip install fastapi uvicorn
python -m pip install ./packages/python-sdk
```

After the Python package is published, replace the local install with `python -m pip install opensend`.

## Example

```python
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from opensend import OpenSend

app = FastAPI()
client = OpenSend(
    os.environ["OPENSEND_API_KEY"],
    base_url=os.environ.get("OPENSEND_BASE_URL"),
)

class SendBody(BaseModel):
    email: EmailStr

@app.post("/send")
def send_email(body: SendBody):
    try:
        email = client.emails.send({
            "from": "OpenSend <onboarding@updates.example.com>",
            "to": body.email,
            "subject": "Hello from FastAPI",
            "html": "<p>FastAPI queued this email.</p>",
        })
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {"id": email["id"]}
```

## Notes

- Keep the client at module scope so it is reused across requests.
- Use FastAPI `BackgroundTasks` or a queue when sending should not block the response.
- Use an idempotency key for duplicate-sensitive sends triggered by retries.
