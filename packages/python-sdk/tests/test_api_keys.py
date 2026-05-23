"""Tests for the api_keys resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]


class TestApiKeysResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_keys(self) -> None:
        self.state.response_body = {
            "object": "api_key",
            "id": "key_1",
            "name": "CI key",
            "token": "os_secret_token",
            "created_at": "2026-01-01T00:00:00Z",
        }
        result = self.client.api_keys.create({"name": "CI key"})
        self.assertEqual(result["token"], "os_secret_token")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api-keys")
        self.assertEqual(req.body["name"], "CI key")

    def test_list_gets_api_keys(self) -> None:
        self.state.response_body = {"object": "list", "data": []}
        result = self.client.api_keys.list()
        self.assertEqual(result["object"], "list")
        req = self.state.requests[0]
        self.assertEqual(req.method, "GET")
        self.assertEqual(req.path, "/api-keys")

    def test_delete_sends_delete_request(self) -> None:
        self.state.response_body = {}
        self.client.api_keys.delete("key_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")
        self.assertEqual(req.path, "/api-keys/key_1")


if __name__ == "__main__":
    unittest.main()
