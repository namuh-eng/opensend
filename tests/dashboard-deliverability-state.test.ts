import {
  dashboardMetricStateLabel,
  getOpenTrackingMetricState,
  getProviderFeedbackMetricState,
} from "@/lib/dashboard-deliverability-state";
import { describe, expect, it } from "vitest";

describe("dashboard deliverability display state", () => {
  it("shows provider feedback as not wired when sends exist without SES feedback wiring", () => {
    const state = getProviderFeedbackMetricState({
      total: 2,
      providerFeedbackWired: false,
    });

    expect(state).toBe("not_wired");
    expect(dashboardMetricStateLabel(state)).toBe("Not wired");
  });

  it("shows provider feedback as unknown when the wiring check is inconclusive", () => {
    const state = getProviderFeedbackMetricState({
      total: 2,
      providerFeedbackWired: false,
      providerFeedbackUnknown: true,
    });

    expect(state).toBe("unknown");
    expect(dashboardMetricStateLabel(state)).toBe("Unknown");
  });

  it("shows open tracking as off when sends exist but open tracking is disabled", () => {
    const state = getOpenTrackingMetricState({
      total: 2,
      openTrackingEnabled: false,
    });

    expect(state).toBe("off");
    expect(dashboardMetricStateLabel(state)).toBe("Off");
  });

  it("keeps empty accounts ready so zero-send cards can render as empty rates", () => {
    expect(
      getProviderFeedbackMetricState({
        total: 0,
        providerFeedbackWired: false,
      }),
    ).toBe("ready");
    expect(
      getOpenTrackingMetricState({
        total: 0,
        openTrackingEnabled: false,
      }),
    ).toBe("ready");
  });
});
