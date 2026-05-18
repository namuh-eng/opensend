from __future__ import annotations

import json
import sys
import threading
import unittest
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import opensend  # noqa: E402


@dataclass
class RecordedRequest:
    method: str
    path: str
    headers: dict[str, str]
    body: Any


@dataclass
class TestServerState:
    response_status: int = 200
    response_body: dict[str, Any] = field(default_factory=lambda: {"id": "email_123"})
    requests: list[RecordedRequest] = field(default_factory=list)


class RecordingHandler(BaseHTTPRequestHandler):
    server: "RecordingServer"

    def do_POST(self) -> None:  # noqa: N802 - http.server hook
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b""
        body = json.loads(raw_body.decode("utf-8")) if raw_body else None
        self.server.state.requests.append(
            RecordedRequest(
                method="POST",
                path=self.path,
                headers={key: value for key, value in self.headers.items()},
                body=body,
            )
        )

        encoded = json.dumps(self.server.state.response_body).encode("utf-8")
        self.send_response(self.server.state.response_status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: object) -> None:
        return


class RecordingServer(ThreadingHTTPServer):
    state: TestServerState


class OpenSendPythonSdkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.state = TestServerState()
        self.server = RecordingServer(("127.0.0.1", 0), RecordingHandler)
        self.server.state = self.state
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}/"
        opensend.api_key = None
        opensend.base_url = opensend.DEFAULT_BASE_URL

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        opensend.api_key = None
        opensend.base_url = opensend.DEFAULT_BASE_URL

    def test_default_base_url_targets_opensend_cloud(self) -> None:
        self.assertEqual(opensend.DEFAULT_BASE_URL, "https://opensend.namuh.co")
        self.assertEqual(opensend.base_url, opensend.DEFAULT_BASE_URL)

    def test_module_level_send_serializes_payload_and_auth_header(self) -> None:
        opensend.api_key = "os_test"
        opensend.base_url = self.base_url

        response = opensend.Emails.send(
            {
                "from": "hello@example.com",
                "to": "user@example.com",
                "subject": "Hello",
                "html": "<p>Hello</p>",
                "tags": [{"name": "source", "value": "python"}],
            }
        )

        self.assertEqual(response, {"id": "email_123"})
        self.assertEqual(len(self.state.requests), 1)
        request = self.state.requests[0]
        self.assertEqual(request.path, "/emails")
        self.assertEqual(request.headers["Authorization"], "Bearer os_test")
        self.assertEqual(request.headers["Content-Type"], "application/json")
        self.assertEqual(
            request.body,
            {
                "from": "hello@example.com",
                "to": "user@example.com",
                "subject": "Hello",
                "html": "<p>Hello</p>",
                "tags": [{"name": "source", "value": "python"}],
            },
        )

    def test_instance_client_normalizes_base_url_and_sends_idempotency_key(self) -> None:
        client = opensend.OpenSend("os_instance", base_url=self.base_url)

        response = client.emails.send(
            {
                "from_": "hello@example.com",
                "to": ["user@example.com"],
                "subject": "Hello",
                "text": "Hello",
            },
            idempotency_key="send-key-1",
        )

        self.assertEqual(response["id"], "email_123")
        request = self.state.requests[0]
        self.assertEqual(request.path, "/emails")
        self.assertEqual(request.headers["Authorization"], "Bearer os_instance")
        self.assertEqual(request.headers["Idempotency-Key"], "send-key-1")
        self.assertEqual(request.body["from"], "hello@example.com")
        self.assertNotIn("from_", request.body)

    def test_send_batch_posts_to_root_batch_endpoint(self) -> None:
        self.state.response_body = {"data": [{"id": "email_a"}, {"id": "email_b"}]}
        client = opensend.Resend("os_batch", base_url=self.base_url)

        response = client.emails.send_batch(
            [
                {
                    "from": "hello@example.com",
                    "to": "a@example.com",
                    "subject": "A",
                    "html": "<p>A</p>",
                },
                {
                    "from_email": "hello@example.com",
                    "to": "b@example.com",
                    "subject": "B",
                    "html": "<p>B</p>",
                },
            ],
            idempotency_key="batch-key-1",
        )

        self.assertEqual(response, {"data": [{"id": "email_a"}, {"id": "email_b"}]})
        request = self.state.requests[0]
        self.assertEqual(request.path, "/emails/batch")
        self.assertEqual(request.headers["Authorization"], "Bearer os_batch")
        self.assertEqual(request.headers["Idempotency-Key"], "batch-key-1")
        self.assertEqual(request.body[1]["from"], "hello@example.com")
        self.assertNotIn("from_email", request.body[1])

    def test_api_error_exposes_public_error_envelope(self) -> None:
        self.state.response_status = 422
        self.state.response_body = {
            "name": "validation_error",
            "code": "validation_error",
            "message": "Validation failed.",
            "statusCode": 422,
            "details": {"fieldErrors": {"to": ["Required"]}, "formErrors": []},
        }
        client = opensend.OpenSend("os_error", base_url=self.base_url)

        with self.assertRaises(opensend.OpenSendError) as context:
            client.emails.send(
                {
                    "from": "hello@example.com",
                    "to": "user@example.com",
                    "subject": "Hello",
                    "html": "<p>Hello</p>",
                }
            )

        error = context.exception
        self.assertEqual(error.status_code, 422)
        self.assertEqual(error.name, "validation_error")
        self.assertEqual(error.code, "validation_error")
        self.assertEqual(error.message, "Validation failed.")
        self.assertEqual(
            error.details,
            {"fieldErrors": {"to": ["Required"]}, "formErrors": []},
        )

    def test_requires_api_key_and_valid_absolute_base_url(self) -> None:
        with self.assertRaisesRegex(ValueError, "API key is required"):
            opensend.OpenSend("", base_url=self.base_url)

        with self.assertRaisesRegex(ValueError, "valid absolute http or https URL"):
            opensend.OpenSend("os_test", base_url="ftp://example.com")

        with self.assertRaisesRegex(ValueError, "set opensend.api_key"):
            opensend.Emails.send(
                {
                    "from": "hello@example.com",
                    "to": "user@example.com",
                    "subject": "Hello",
                    "html": "<p>Hello</p>",
                },
                base_url=self.base_url,
            )


if __name__ == "__main__":
    unittest.main()
