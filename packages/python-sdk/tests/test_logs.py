"""Tests for the logs resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestLogsResource(ApiTestBase, unittest.TestCase):
    def test_list_logs_with_filters(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.logs.list(
            {
                "status": "200",
                "method": "POST",
                "limit": 50,
                "date_from": "2026-01-01",
                "date_to": "2026-05-01",
            }
        )
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertIn("status=200", req.path)
        self.assertIn("method=POST", req.path)
        self.assertIn("date_from=2026-01-01", req.path)
        self.assertIn("date_to=2026-05-01", req.path)
        self.assertIn("limit=50", req.path)

    def test_list_logs_with_search(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.logs.list({"search": "/emails", "user_agent": "curl/7"})
        req = self.state.requests[0]
        self.assertIn("search=%2Femails", req.path)
        self.assertIn("user_agent=curl%2F7", req.path)

    def test_get_log_by_id(self) -> None:
        self.state.response_body = {
            "object": "log",
            "id": "log_1",
            "method": "POST",
            "endpoint": "/emails",
            "status": 200,
            "user_agent": None,
            "api_key_id": None,
            "request_body": None,
            "response_body": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
        result = self.client.logs.get("log_1")
        self.assertEqual(result["id"], "log_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertEqual(req.path, "/api/logs/log_1")


if __name__ == "__main__":
    unittest.main()
