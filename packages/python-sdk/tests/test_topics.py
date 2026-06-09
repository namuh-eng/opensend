"""Tests for the topics resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]

_TOPIC = {
    "object": "topic",
    "id": "top_1",
    "name": "Product Updates",
    "description": None,
    "default_subscription": "opt_in",
    "visibility": "public",
    "created_at": "2026-01-01T00:00:00Z",
}


class TestTopicsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_topics(self) -> None:
        self.state.response_body = _TOPIC
        result = self.client.topics.create({"name": "Product Updates", "visibility": "public"})
        self.assertEqual(result["id"], "top_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/topics")

    def test_list_with_search(self) -> None:
        self.state.response_body = {
            "object": "list",
            "data": [],
            "has_more": False,
            "total": 0,
        }
        self.client.topics.list({"search": "Product"})
        req = self.state.requests[0]
        self.assertIn("search=Product", req.path)

    def test_get_by_id(self) -> None:
        self.state.response_body = _TOPIC
        self.client.topics.get("top_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/api/topics/top_1")

    def test_update_patches_topic(self) -> None:
        self.state.response_body = {**_TOPIC, "name": "Latest News"}
        result = self.client.topics.update("top_1", {"name": "Latest News"})
        self.assertEqual(result["name"], "Latest News")
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")

    def test_delete_topic(self) -> None:
        self.state.response_body = {"success": True}
        result = self.client.topics.delete("top_1")
        self.assertTrue(result["success"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")


if __name__ == "__main__":
    unittest.main()
