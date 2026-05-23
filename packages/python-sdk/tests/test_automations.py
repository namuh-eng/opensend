"""Tests for the automations resource."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from conftest import ApiTestBase  # type: ignore[import]

_AUTOMATION_DETAIL = {
    "object": "automation",
    "id": "auto_1",
    "name": "Welcome flow",
    "status": "draft",
    "trigger_event_name": None,
    "connections": [],
    "steps": [],
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


class TestAutomationsResource(ApiTestBase, unittest.TestCase):
    def test_create_posts_to_api_automations(self) -> None:
        self.state.response_body = _AUTOMATION_DETAIL
        result = self.client.automations.create(
            {
                "name": "Welcome flow",
                "steps": [{"key": "trigger", "type": "trigger"}],
            }
        )
        self.assertEqual(result["id"], "auto_1")
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/automations")

    def test_list_with_status_filter(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.automations.list(status="enabled")
        req = self.state.requests[0]
        self.assertIn("status=enabled", req.path)

    def test_get_by_id(self) -> None:
        self.state.response_body = _AUTOMATION_DETAIL
        self.client.automations.get("auto_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/api/automations/auto_1")

    def test_update_patches_automation(self) -> None:
        self.state.response_body = _AUTOMATION_DETAIL
        self.client.automations.update("auto_1", {"status": "enabled"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "PATCH")

    def test_delete_automation(self) -> None:
        self.state.response_body = {"object": "automation", "id": "auto_1", "deleted": True}
        result = self.client.automations.delete("auto_1")
        self.assertTrue(result["deleted"])
        req = self.state.requests[0]
        self.assertEqual(req.method, "DELETE")

    def test_list_runs(self) -> None:
        self.state.response_body = {"object": "list", "data": [], "has_more": False}
        self.client.automations.list_runs("auto_1", {"status": "completed", "limit": 5})
        req = self.state.requests[0]
        self.assertIn("/api/automations/auto_1/runs", req.path)
        self.assertIn("status=completed", req.path)

    def test_get_run(self) -> None:
        self.state.response_body = {
            "object": "automation_run",
            "id": "run_1",
            "automation_id": "auto_1",
            "status": "completed",
            "created_at": "2026-01-02T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
            "step_states": {},
        }
        result = self.client.automations.get_run("auto_1", "run_1")
        self.assertEqual(result["id"], "run_1")
        req = self.state.requests[0]
        self.assertEqual(req.path, "/api/automations/auto_1/runs/run_1")

    def test_cancel_run_posts_to_cancel_endpoint(self) -> None:
        self.state.response_body = {
            "object": "automation_run",
            "id": "run_1",
            "automation_id": "auto_1",
            "status": "cancelled",
            "created_at": "2026-01-02T00:00:00Z",
            "updated_at": "2026-01-02T00:00:00Z",
            "step_states": {},
        }
        self.client.automations.cancel_run("auto_1", "run_1", {"reason": "manual"})
        req = self.state.requests[0]
        self.assertEqual(req.method, "POST")
        self.assertEqual(req.path, "/api/automations/auto_1/runs/run_1/cancel")
        self.assertEqual(req.body["reason"], "manual")

    def test_get_run_metrics(self) -> None:
        self.state.response_body = {
            "object": "automation_run_metrics",
            "automation_id": "auto_1",
            "total_runs": 42,
            "by_status": {},
            "completion_rate": 0.9,
            "failure_rate": 0.1,
            "average_duration_ms": 500.0,
            "waiting_count": 0,
            "failed_steps": [],
            "range": {"from": None, "to": None},
        }
        result = self.client.automations.get_run_metrics(
            "auto_1", {"from_date": "2026-01-01", "to_date": "2026-05-01"}
        )
        self.assertEqual(result["total_runs"], 42)
        req = self.state.requests[0]
        self.assertIn("/api/automations/auto_1/runs/metrics", req.path)
        self.assertIn("from=2026-01-01", req.path)
        self.assertIn("to=2026-05-01", req.path)


if __name__ == "__main__":
    unittest.main()
