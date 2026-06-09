"""Tests for the suppressions resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]

_SUPPRESSION = {
    "id": "sup_1",
    "object": "suppression",
    "email": "bounce@example.com",
    "reason": "bounce",
    "scope": "user",
    "source_event_id": None,
    "source_email_id": None,
    "source_message_id": None,
    "metadata": None,
    "suppressed_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


class TestSuppressionsResource(ApiTestBase, unittest.TestCase):
    def test_list_suppressions(self) -> None:
        self.state.response_body = {
            "object": "list",
            "scope": "user",
            "data": [_SUPPRESSION],
            "has_more": False,
        }
        result = self.client.suppressions.list({"limit": 20})
        self.assertEqual(len(result["data"]), 1)
        req = self.state.requests[0]
        self.assertIn("limit=20", req.path)

    def test_get_suppression_by_email(self) -> None:
        self.state.response_body = _SUPPRESSION
        result = self.client.suppressions.get("bounce@example.com")
        self.assertEqual(result["email"], "bounce@example.com")
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertIn("bounce%40example.com", req.path)

    def test_create_suppression(self) -> None:
        self.state.response_body = _SUPPRESSION
        result = self.client.suppressions.create(
            {"email": "bounce@example.com", "reason": "bounce"},
            idempotency_key="sup-idem",
        )
        self.assertEqual(result["reason"], "bounce")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/suppressions")
        self.assertEqual(req.headers.get("Idempotency-Key"), "sup-idem")

    def test_delete_suppression(self) -> None:
        self.state.response_body = {"object": "suppression", "deleted": True}
        result = self.client.suppressions.delete("bounce@example.com")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")
        self.assertIn("bounce%40example.com", req.path)


if __name__ == "__main__":
    unittest.main()
