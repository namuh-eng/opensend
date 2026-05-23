"""Tests for the events resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestEventsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_events(self) -> None:
        self.state.response_body = {
            "object": "event",
            "id": "evt_schema_1",
            "name": "user.signed_up",
            "schema": None,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        result = self.client.events.create({"name": "user.signed_up"})
        self.assertEqual(result["name"], "user.signed_up")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/events")

    def test_list_events(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.events.list({"limit": 5})
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertIn("limit=5", req.path)

    def test_send_event_posts_to_events_send(self) -> None:
        self.state.response_body = {
            "object": "event_delivery",
            "delivery": {"object": "event_delivery", "id": "del_1", "event": "user.signed_up", "received_at": "2026-01-01T00:00:00Z"},
            "resumed_runs": [],
            "automation_runs": [],
        }
        result = self.client.events.send(
            {"event": "user.signed_up", "email": "user@example.com"}
        )
        self.assertEqual(result["object"], "event_delivery")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/events/send")
        self.assertEqual(req.body["event"], "user.signed_up")


if __name__ == "__main__":
    unittest.main()
