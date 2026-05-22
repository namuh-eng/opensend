"""Automations resource for the OpenSend Python SDK."""

from __future__ import annotations

from typing import Any, Mapping, Optional, cast

from ._http import HttpClient, JsonObject
from ._types import (
    AutomationDeleteResponse,
    AutomationDetailResponse,
    AutomationListResponse,
    AutomationRunDetailItem,
    AutomationRunListOptions,
    AutomationRunListResponse,
    AutomationRunMetricsOptions,
    AutomationRunMetricsResponse,
    CancelAutomationRunPayload,
    CreateAutomationPayload,
    ListOptions,
)

# UpdateAutomationPayload is a partial of CreateAutomationPayload — accept Mapping
UpdateAutomationPayload = Mapping[str, Any]


def _normalize_automation_payload(payload: Mapping[str, Any]) -> JsonObject:
    """Normalize connection 'from_key' alias to 'from' key expected by the API."""
    result = dict(payload)
    connections = result.get("connections")
    if isinstance(connections, list):
        normalized_conns = []
        for conn in connections:
            c = dict(conn)
            from_key = c.pop("from_key", None)
            if "from" not in c and from_key is not None:
                c["from"] = from_key
            normalized_conns.append(c)
        result["connections"] = normalized_conns
    return result


class AutomationsResource:
    """Full automation lifecycle: create, list, get, update, delete, runs, metrics."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def create(self, payload: CreateAutomationPayload) -> AutomationDetailResponse:
        """Create a new automation workflow."""
        return cast(
            AutomationDetailResponse,
            self._client.request(
                "POST", "/api/automations", _normalize_automation_payload(payload)
            ),
        )

    def list(
        self,
        options: Optional[ListOptions] = None,
        *,
        status: Optional[str] = None,
    ) -> AutomationListResponse:
        """List automations with optional pagination and status filter."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if status:
            query["status"] = status
        return cast(
            AutomationListResponse,
            self._client.request("GET", "/api/automations", params=query or None),
        )

    def get(self, automation_id: str) -> AutomationDetailResponse:
        """Retrieve an automation by ID."""
        return cast(
            AutomationDetailResponse,
            self._client.request("GET", f"/api/automations/{automation_id}"),
        )

    def update(
        self, automation_id: str, payload: UpdateAutomationPayload
    ) -> AutomationDetailResponse:
        """Update an automation's definition."""
        return cast(
            AutomationDetailResponse,
            self._client.request(
                "PATCH",
                f"/api/automations/{automation_id}",
                _normalize_automation_payload(payload),
            ),
        )

    def delete(self, automation_id: str) -> AutomationDeleteResponse:
        """Delete an automation by ID."""
        return cast(
            AutomationDeleteResponse,
            self._client.request("DELETE", f"/api/automations/{automation_id}"),
        )

    # -----------------------------------------------------------------------
    # Runs
    # -----------------------------------------------------------------------

    def list_runs(
        self, automation_id: str, options: Optional[AutomationRunListOptions] = None
    ) -> AutomationRunListResponse:
        """List execution runs for an automation."""
        opts = options or {}
        query: dict[str, str] = {}
        if opts.get("limit") is not None:
            query["limit"] = str(opts["limit"])
        if opts.get("after"):
            query["after"] = opts["after"]  # type: ignore[assignment]
        if opts.get("status"):
            query["status"] = opts["status"]  # type: ignore[assignment]
        return cast(
            AutomationRunListResponse,
            self._client.request(
                "GET",
                f"/api/automations/{automation_id}/runs",
                params=query or None,
            ),
        )

    def get_run(self, automation_id: str, run_id: str) -> AutomationRunDetailItem:
        """Retrieve a single automation run by ID."""
        return cast(
            AutomationRunDetailItem,
            self._client.request(
                "GET", f"/api/automations/{automation_id}/runs/{run_id}"
            ),
        )

    def cancel_run(
        self,
        automation_id: str,
        run_id: str,
        payload: Optional[CancelAutomationRunPayload] = None,
    ) -> AutomationRunDetailItem:
        """Cancel an in-progress automation run."""
        return cast(
            AutomationRunDetailItem,
            self._client.request(
                "POST",
                f"/api/automations/{automation_id}/runs/{run_id}/cancel",
                payload or {},
            ),
        )

    def get_run_metrics(
        self, automation_id: str, options: Optional[AutomationRunMetricsOptions] = None
    ) -> AutomationRunMetricsResponse:
        """Get run metrics (completion rate, failure rate, etc.) for an automation."""
        opts = options or {}
        query: dict[str, str] = {}
        # from_date and to_date map to "from" and "to" on the wire
        if opts.get("from_date"):
            query["from"] = opts["from_date"]  # type: ignore[assignment]
        if opts.get("to_date"):
            query["to"] = opts["to_date"]  # type: ignore[assignment]
        return cast(
            AutomationRunMetricsResponse,
            self._client.request(
                "GET",
                f"/api/automations/{automation_id}/runs/metrics",
                params=query or None,
            ),
        )
