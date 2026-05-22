"""Tests for the segments resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestSegmentsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_segments(self) -> None:
        self.state.response_body = {"object": "segment", "id": "seg_1", "name": "VIP"}
        result = self.client.segments.create({"name": "VIP"})
        self.assertEqual(result["id"], "seg_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/segments")

    def test_list_includes_search_param(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.segments.list({"search": "VIP", "limit": 5})
        req = self.state.requests[0]
        self.assertIn("search=VIP", req.path)
        self.assertIn("limit=5", req.path)

    def test_get_fetches_by_id(self) -> None:
        self.state.response_body = {"object": "segment", "id": "seg_1"}
        self.client.segments.get("seg_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/segments/seg_1")

    def test_delete_sends_delete(self) -> None:
        self.state.response_body = {"object": "segment", "id": "seg_1", "deleted": True}
        result = self.client.segments.delete("seg_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")
        self.assertEqual(req.path, "/segments/seg_1")

    def test_list_contacts_hits_contacts_sub_resource(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.segments.list_contacts("seg_1", {"limit": 20})
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertIn("/segments/seg_1/contacts", req.path)
        self.assertIn("limit=20", req.path)


if __name__ == "__main__":
    unittest.main()
