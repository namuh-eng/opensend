"""Tests for the templates resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestTemplatesResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_templates(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_1"}
        result = self.client.templates.create({"name": "Welcome", "html": "<p>Hi</p>"})
        self.assertEqual(result["id"], "tmpl_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/templates")

    def test_list_with_status_filter(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.templates.list({"status": "published", "search": "Welcome"})
        req = self.state.requests[0]
        self.assertIn("status=published", req.path)
        self.assertIn("search=Welcome", req.path)

    def test_get_by_alias(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_1", "name": "Welcome"}
        self.client.templates.get("welcome-email")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/templates/welcome-email")

    def test_update_patches_template(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_1"}
        self.client.templates.update("tmpl_1", {"name": "Updated Welcome"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")
        self.assertEqual(req.path, "/templates/tmpl_1")

    def test_delete_template(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_1", "deleted": True}
        result = self.client.templates.delete("tmpl_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")

    def test_publish_posts_to_publish_endpoint(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_1"}
        self.client.templates.publish("tmpl_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/templates/tmpl_1/publish")

    def test_duplicate_posts_to_duplicate_endpoint(self) -> None:
        self.state.response_body = {"object": "template", "id": "tmpl_2"}
        result = self.client.templates.duplicate("tmpl_1")
        self.assertEqual(result["id"], "tmpl_2")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/templates/tmpl_1/duplicate")


if __name__ == "__main__":
    unittest.main()
