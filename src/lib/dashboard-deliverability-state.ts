export type DashboardMetricState = "ready" | "not_wired" | "unknown" | "off";

export function getProviderFeedbackMetricState(input: {
  total: number;
  providerFeedbackWired: boolean;
  providerFeedbackUnknown?: boolean;
}): DashboardMetricState {
  if (input.total > 0 && input.providerFeedbackUnknown) {
    return "unknown";
  }
  if (input.total > 0 && !input.providerFeedbackWired) {
    return "not_wired";
  }
  return "ready";
}

export function getOpenTrackingMetricState(input: {
  total: number;
  openTrackingEnabled: boolean;
}): DashboardMetricState {
  if (input.total > 0 && !input.openTrackingEnabled) {
    return "off";
  }
  return "ready";
}

export function dashboardMetricStateLabel(
  state: DashboardMetricState,
): string | null {
  if (state === "not_wired") return "Not wired";
  if (state === "unknown") return "Unknown";
  if (state === "off") return "Off";
  return null;
}
