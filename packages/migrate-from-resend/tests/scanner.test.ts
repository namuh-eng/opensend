import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanResendUsage } from "../src/scanner";

const fixtureRoot = path.join(import.meta.dirname, "fixtures");

describe("scanResendUsage", () => {
  it("detects common Resend SDK imports, calls, environment variables, and REST endpoints", async () => {
    const result = await scanResendUsage({
      targetDir: path.join(fixtureRoot, "resend-app"),
    });

    const ids = result.findings.map((finding) => finding.entry.id);
    expect(ids).toContain("sdk-import-resend");
    expect(ids).toContain("sdk-client-constructor");
    expect(ids).toContain("emails-send");
    expect(ids).toContain("emails-batch");
    expect(ids).toContain("contacts");
    expect(ids).toContain("broadcasts");
    expect(ids).toContain("env-api-key");
    expect(ids).toContain("env-base-url");
    expect(ids).toContain("rest-emails-batch");
    expect(ids).toContain("rest-api-keys");
    expect(ids).toContain("rest-segments");
  });

  it("maps partial, unsupported, and unknown statuses honestly", async () => {
    const result = await scanResendUsage({
      targetDir: path.join(fixtureRoot, "resend-app"),
    });

    const byId = new Map(
      result.findings.map((finding) => [
        finding.entry.id,
        finding.entry.status,
      ]),
    );
    expect(byId.get("contacts")).toBe("partial");
    expect(byId.get("mcp-resend")).toBe("unsupported");
    expect(byId.get("inbound-received-emails")).toBe("unknown");
    expect(byId.get("unknown-resend-usage")).toBe("unknown");
    expect(byId.get("rest-unknown-resend-api")).toBe("unknown");

    const sameLineUnknown = result.findings.find((finding) =>
      finding.match.includes("someSameLineFutureResource"),
    );
    expect(sameLineUnknown?.entry.status).toBe("unknown");
  });

  it("returns an empty finding set when no Resend usage is present", async () => {
    const result = await scanResendUsage({
      targetDir: path.join(fixtureRoot, "empty-app"),
    });

    expect(result.scannedFiles).toBe(1);
    expect(result.findings).toEqual([]);
  });
});
