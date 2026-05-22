"""Tests for the broadcasts resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestBroadcastsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_broadcasts(self) -> None:
        self.state.response_body = {
            "object": "broadcast",
            "id": "bcast_1",
            "name": "May Newsletter",
            "status": "draft",
            "created_at": "2026-05-01T00:00:00Z",
        }
        result = self.client.broadcasts.create(
            {
                "name": "May Newsletter",
                "subject": "May news",
                "html": "<p>Hello</p>",
            }
        )
        self.assertEqual(result["id"], "bcast_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/broadcasts")

    def test_create_with_idempotency_key(self) -> None:
        self.state.response_body = {"object": "broadcast", "id": "bcast_2", "status": "draft", "created_at": "2026-05-01T00:00:00Z"}
        self.client.broadcasts.create(
            {"name": "B", "subject": "S", "html": "<p>H</p>"},
            idempotency_key="idem-key-1",
        )
        req = self.state.requests[0]
        self.assertEqual(req.headers.get("Idempotency-Key"), "idem-key-1")

    def test_list_with_status_filter(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.broadcasts.list({"status": "sent", "limit": 10})
        req = self.state.requests[0]
        self.assertIn("status=sent", req.path)
        self.assertIn("limit=10", req.path)

    def test_get_fetches_by_id(self) -> None:
        self.state.response_body = {"object": "broadcast", "id": "bcast_1", "status": "draft", "created_at": "2026-01-01T00:00:00Z"}
        self.client.broadcasts.get("bcast_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/broadcasts/bcast_1")

    def test_update_patches_broadcast(self) -> None:
        self.state.response_body = {"object": "broadcast", "id": "bcast_1", "status": "draft", "created_at": "2026-01-01T00:00:00Z"}
        self.client.broadcasts.update("bcast_1", {"subject": "New subject"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")
        self.assertEqual(req.body["subject"], "New subject")

    def test_delete_sends_delete(self) -> None:
        self.state.response_body = {"object": "broadcast", "id": "bcast_1", "deleted": True}
        result = self.client.broadcasts.delete("bcast_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")

    def test_send_posts_to_send_endpoint(self) -> None:
        self.state.response_body = {
            "object": "broadcast",
            "id": "bcast_1",
            "status": "queued",
            "scheduled_at": None,
        }
        result = self.client.broadcasts.send("bcast_1", idempotency_key="send-idem")
        self.assertEqual(result["status"], "queued")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/broadcasts/bcast_1/send")
        self.assertEqual(req.headers.get("Idempotency-Key"), "send-idem")

    def test_send_with_scheduled_at(self) -> None:
        self.state.response_body = {
            "object": "broadcast",
            "id": "bcast_1",
            "status": "scheduled",
            "scheduled_at": "2026-06-01T09:00:00Z",
        }
        self.client.broadcasts.send("bcast_1", {"scheduled_at": "2026-06-01T09:00:00Z"})
        req = self.state.requests[0]
        self.assertEqual(req.body.get("scheduled_at"), "2026-06-01T09:00:00Z")


if __name__ == "__main__":
    unittest.main()
