"""Tests for the audiences resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestAudiencesResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_audiences(self) -> None:
        self.state.response_body = {"object": "audience", "id": "aud_1", "name": "Newsletter"}
        result = self.client.audiences.create({"name": "Newsletter"})
        self.assertEqual(result["id"], "aud_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/audiences")

    def test_list_with_search_and_pagination(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.audiences.list({"search": "News", "limit": 5})
        req = self.state.requests[0]
        self.assertIn("search=News", req.path)
        self.assertIn("limit=5", req.path)

    def test_get_fetches_by_id(self) -> None:
        self.state.response_body = {"object": "audience", "id": "aud_1"}
        self.client.audiences.get("aud_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/audiences/aud_1")

    def test_delete_sends_delete(self) -> None:
        self.state.response_body = {"object": "audience", "id": "aud_1", "deleted": True}
        result = self.client.audiences.delete("aud_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")


if __name__ == "__main__":
    unittest.main()
