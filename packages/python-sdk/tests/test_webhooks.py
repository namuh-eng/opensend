"""Tests for the webhooks resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]

_WEBHOOK = {
    "object": "webhook",
    "id": "wh_1",
    "endpoint": "https://example.com/hook",
    "events": ["email.sent"],
    "status": "enabled",
    "created_at": "2026-01-01T00:00:00Z",
}


class TestWebhooksResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_webhooks(self) -> None:
        self.state.response_body = {**_WEBHOOK, "signing_secret": "whsec_secret"}
        result = self.client.webhooks.create(
            {"endpoint": "https://example.com/hook", "events": ["email.sent"]},
            idempotency_key="wh-idem-1",
        )
        self.assertEqual(result["signing_secret"], "whsec_secret")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/webhooks")
        self.assertEqual(req.headers.get("Idempotency-Key"), "wh-idem-1")

    def test_list_with_pagination(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.webhooks.list({"limit": 10})
        req = self.state.requests[0]
        self.assertIn("limit=10", req.path)

    def test_get_webhook_with_deliveries(self) -> None:
        self.state.response_body = {**_WEBHOOK, "recent_deliveries": []}
        result = self.client.webhooks.get("wh_1")
        self.assertEqual(result["id"], "wh_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/api/webhooks/wh_1")

    def test_update_patches_webhook(self) -> None:
        self.state.response_body = {**_WEBHOOK, "status": "disabled"}
        self.client.webhooks.update("wh_1", {"status": "disabled"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")
        self.assertEqual(req.body["status"], "disabled")

    def test_delete_webhook(self) -> None:
        self.state.response_body = {"object": "webhook", "id": "wh_1", "deleted": True}
        result = self.client.webhooks.delete("wh_1")
        self.assertTrue(result["deleted"])

    def test_list_deliveries(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.webhooks.list_deliveries("wh_1", {"limit": 5})
        req = self.state.requests[0]
        self.assertIn("/api/webhooks/wh_1/deliveries", req.path)
        self.assertIn("limit=5", req.path)

    def test_replay_delivery_posts_to_replay_endpoint(self) -> None:
        self.state.response_body = {
            "object": "webhook_delivery_replay",
            "original_delivery": {"id": "del_1", "created_at": "2026-01-01T00:00:00Z"},
            "replay_delivery": {"id": "del_2", "created_at": "2026-01-01T00:01:00Z"},
        }
        result = self.client.webhooks.replay_delivery("wh_1", "del_1")
        self.assertEqual(result["object"], "webhook_delivery_replay")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/webhooks/wh_1/deliveries/del_1/replay")


if __name__ == "__main__":
    unittest.main()
