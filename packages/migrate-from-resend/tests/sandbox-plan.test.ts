import { describe, expect, it, vi } from "vitest";
import { buildSandboxRequestPlan } from "../src/sandbox-plan";

describe("buildSandboxRequestPlan", () => {
  it("builds redacted planned requests without performing network calls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const plan = buildSandboxRequestPlan({
      baseUrl: "https://opensend.example.com/",
      apiKey: "os_secret",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({
      method: "POST",
      url: "https://opensend.example.com/emails",
      status: "planned-not-sent",
    });
    expect(plan[0]?.headers.Authorization).toBe("Bearer <redacted>");
    expect(JSON.stringify(plan)).toContain("delivered@resend.dev");

    vi.unstubAllGlobals();
  });

  it("validates base URL shape", () => {
    expect(() =>
      buildSandboxRequestPlan({ baseUrl: "ftp://opensend.example.com" }),
    ).toThrow("baseUrl must use http or https");
  });
});
