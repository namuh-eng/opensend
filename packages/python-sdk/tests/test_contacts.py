"""Tests for the contacts resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestContactsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_contacts(self) -> None:
        self.state.response_body = {"object": "contact", "id": "c_1"}
        result = self.client.contacts.create({"email": "user@example.com"})
        self.assertEqual(result["id"], "c_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/contacts")
        self.assertEqual(req.body["email"], "user@example.com")

    def test_list_gets_contacts_with_pagination(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.contacts.list({"limit": 10, "after": "cur_abc"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertIn("limit=10", req.path)
        self.assertIn("after=cur_abc", req.path)

    def test_get_fetches_single_contact(self) -> None:
        self.state.response_body = {"object": "contact", "id": "c_1", "email": "user@example.com"}
        result = self.client.contacts.get("c_1")
        self.assertEqual(result["email"], "user@example.com")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/contacts/c_1")

    def test_update_patches_contact(self) -> None:
        self.state.response_body = {"object": "contact", "id": "c_1", "unsubscribed": True}
        result = self.client.contacts.update("c_1", {"unsubscribed": True})
        self.assertTrue(result["unsubscribed"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")
        self.assertEqual(req.path, "/contacts/c_1")

    def test_delete_sends_delete_request(self) -> None:
        self.state.response_body = {"object": "contact", "id": "c_1", "deleted": True}
        result = self.client.contacts.delete("c_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")
        self.assertEqual(req.path, "/contacts/c_1")


if __name__ == "__main__":
    unittest.main()
