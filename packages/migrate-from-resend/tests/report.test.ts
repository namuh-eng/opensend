import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdownReport } from "../src/report";
import { buildSandboxRequestPlan } from "../src/sandbox-plan";
import { scanResendUsage } from "../src/scanner";

const fixtureRoot = path.join(import.meta.dirname, "fixtures");

describe("renderMarkdownReport", () => {
  it("includes findings, environment diff, caveats, rerun commands, and evidence", async () => {
    const scan = await scanResendUsage({
      targetDir: path.join(fixtureRoot, "resend-app"),
    });
    const report = renderMarkdownReport(scan, {
      command: "migrate-from-resend tests/fixtures/resend-app",
      baseUrl: "http://localhost:3015",
      sandboxPlans: buildSandboxRequestPlan({
        baseUrl: "http://localhost:3015",
        apiKey: "os_secret",
      }),
    });

    expect(report).toContain("# OpenSend migration compatibility report");
    expect(report).toContain(
      "| `RESEND_API_KEY` / `re_...` | `OPENSEND_API_KEY` / `os_...` |",
    );
    expect(report).toContain("planned-not-sent");
    expect(report).toContain("Bearer <redacted>");
    expect(report).toContain(
      "No codemods or automatic rewrites are performed.",
    );
    expect(report).toContain("agent_docs/resend-parity.md#Single send");
    expect(report).toContain(
      "migrate-from-resend tests/fixtures/resend-app --sandbox-plan",
    );
  });

  it("renders an empty scan as a shareable report", async () => {
    const scan = await scanResendUsage({
      targetDir: path.join(fixtureRoot, "empty-app"),
    });
    const report = renderMarkdownReport(scan, {
      command: "migrate-from-resend tests/fixtures/empty-app",
    });

    expect(report).toContain("Findings: 0");
    expect(report).toContain("No Resend SDK imports");
    expect(report).toContain("Not requested. Re-run with `--sandbox-plan");
  });
});
