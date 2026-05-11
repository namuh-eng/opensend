import { AutomationRunDetail } from "@/components/automation-run-detail";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const baseRun = {
  id: "run_1",
  automation_id: "auto_1",
  trigger_event_id: "event_1",
  contact_id: "contact_1",
  status: "waiting",
  current_step_key: "wait_for_event",
  failed_step_key: null,
  failure_reason: null,
  step_states: {
    condition: {
      status: "completed",
      output: { matched: true, branch: "condition_met" },
    },
    wait_for_event: {
      status: "waiting",
      output: {
        waiting_for_event: "invoice.paid",
        payload: { secret: "do-not-render", amount: 42 },
        email: "customer@example.com",
      },
    },
  },
  started_at: "2026-05-02T10:00:00.000Z",
  completed_at: null,
  next_step_at: "2026-05-03T10:00:00.000Z",
  duration_ms: null,
  created_at: "2026-05-02T10:00:00.000Z",
  updated_at: "2026-05-02T10:00:00.000Z",
};

describe("AutomationRunDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(cleanup);

  it("summarizes advanced outputs without dumping sensitive payloads", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(baseRun),
    });

    render(<AutomationRunDetail automationId="auto_1" runId="run_1" />);

    await waitFor(() =>
      expect(screen.getAllByText("wait_for_event").length).toBeGreaterThan(0),
    );
    expect(screen.getByText("waiting_for_event")).toBeTruthy();
    expect(screen.getByText("invoice.paid")).toBeTruthy();
    expect(screen.getByText("Hidden event payload (2 keys)")).toBeTruthy();
    expect(screen.getByText("Redacted")).toBeTruthy();
    expect(screen.queryByText("do-not-render")).toBeNull();
    expect(screen.queryByText("customer@example.com")).toBeNull();
  });

  it("cancels waiting runs through the run cancel endpoint", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(baseRun) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...baseRun, status: "cancelled" }),
      });

    render(<AutomationRunDetail automationId="auto_1" runId="run_1" />);

    const cancelButton = await screen.findByRole("button", {
      name: "Cancel run",
    });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/automations/auto_1/runs/run_1/cancel",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
