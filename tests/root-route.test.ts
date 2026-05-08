import { shouldRedirectRootToDashboard } from "@/lib/root-route";
import { describe, expect, it } from "vitest";

describe("root route session branching", () => {
  it("redirects authenticated sessions to the dashboard", () => {
    expect(shouldRedirectRootToDashboard({ user: { id: "user-123" } })).toBe(
      true,
    );
  });

  it("renders landing for missing or anonymous sessions", () => {
    expect(shouldRedirectRootToDashboard(null)).toBe(false);
    expect(shouldRedirectRootToDashboard(undefined)).toBe(false);
    expect(shouldRedirectRootToDashboard({ user: {} })).toBe(false);
  });
});
