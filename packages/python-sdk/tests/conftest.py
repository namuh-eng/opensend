"""Shared test fixtures for the OpenSend Python SDK test suite."""

from __future__ import annotations

import json
import sys
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# Make the local source importable without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


@dataclass
class RecordedRequest:
    method: str
    path: str
    headers: dict[str, str]
    body: Any


@dataclass
class ServerState:
    response_status: int = 200
    response_body: Any = field(default_factory=lambda: {"id": "stub"})
    requests: list[RecordedRequest] = field(default_factory=list)


class RecordingHandler(BaseHTTPRequestHandler):
    server: "RecordingServer"

    def _handle(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length) if content_length else b""
        body = json.loads(raw_body.decode()) if raw_body else None
        self.server.state.requests.append(
            RecordedRequest(
                method=self.command,
                path=self.path,
                headers={k: v for k, v in self.headers.items()},
                body=body,
            )
        )
        encoded = json.dumps(self.server.state.response_body).encode()
        self.send_response(self.server.state.response_status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    do_GET = _handle
    do_POST = _handle
    do_PATCH = _handle
    do_DELETE = _handle

    def log_message(self, format: str, *args: object) -> None:
        return  # silence output in tests


class RecordingServer(ThreadingHTTPServer):
    state: ServerState


class ApiTestBase:
    """Mixin that spins up a local recording HTTP server for each test."""

    def setUp(self) -> None:
        import opensend

        self.state = ServerState()
        self.server = RecordingServer(("127.0.0.1", 0), RecordingHandler)
        self.server.state = self.state
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self._thread.start()
        port = self.server.server_address[1]
        self.base_url = f"http://127.0.0.1:{port}"
        self.client = opensend.OpenSend("os_test_key", base_url=self.base_url)
        # Reset module-level state
        opensend.api_key = None
        opensend.base_url = opensend.DEFAULT_BASE_URL

    def tearDown(self) -> None:
        import opensend

        self.server.shutdown()
        self.server.server_close()
        self._thread.join(timeout=2)
        opensend.api_key = None
        opensend.base_url = opensend.DEFAULT_BASE_URL
