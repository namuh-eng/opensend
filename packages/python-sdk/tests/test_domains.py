"""Tests for the domains resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestDomainsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_domains(self) -> None:
        self.state.response_body = {
            "object": "domain",
            "id": "dom_1",
            "name": "mail.example.com",
            "status": "pending",
            "created_at": "2026-01-01T00:00:00Z",
            "records": [],
        }
        result = self.client.domains.create({"name": "mail.example.com", "region": "us-east-1"})

        self.assertEqual(result["id"], "dom_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/domains")
        self.assertEqual(req.body["name"], "mail.example.com")

    def test_list_gets_api_domains(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        result = self.client.domains.list()
        self.assertEqual(result["object"], "list")
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertEqual(req.path, "/api/domains")

    def test_get_fetches_single_domain(self) -> None:
        self.state.response_body = {"object": "domain", "id": "dom_1", "name": "mail.example.com"}
        result = self.client.domains.get("dom_1")
        self.assertEqual(result["id"], "dom_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/api/domains/dom_1")

    def test_update_patches_domain(self) -> None:
        self.state.response_body = {"object": "domain", "id": "dom_1"}
        self.client.domains.update("dom_1", {"open_tracking": True})
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")
        self.assertEqual(req.path, "/api/domains/dom_1")
        self.assertTrue(req.body["open_tracking"])

    def test_verify_posts_to_verify_endpoint(self) -> None:
        self.state.response_body = {"object": "domain", "id": "dom_1", "status": "verified"}
        result = self.client.domains.verify("dom_1")
        self.assertEqual(result["status"], "verified")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/domains/dom_1/verify")

    def test_delete_sends_delete_request(self) -> None:
        self.state.response_body = {"object": "domain", "id": "dom_1", "deleted": True}
        result = self.client.domains.delete("dom_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")
        self.assertEqual(req.path, "/api/domains/dom_1")


if __name__ == "__main__":
    unittest.main()
