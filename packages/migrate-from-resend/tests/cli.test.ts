import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli";

describe("runCli", () => {
  it("fails closed when target-dir is omitted", async () => {
    await expect(runCli([])).rejects.toThrow("target-dir is required");
  });

  it("requires an explicit base URL for sandbox request planning", async () => {
    const originalBaseUrl = process.env.OPENSEND_BASE_URL;
    Reflect.deleteProperty(process.env, "OPENSEND_BASE_URL");

    await expect(
      runCli(["tests/fixtures/empty-app", "--sandbox-plan"]),
    ).rejects.toThrow(
      "--base-url or OPENSEND_BASE_URL is required when --sandbox-plan is used",
    );

    if (originalBaseUrl === undefined) {
      Reflect.deleteProperty(process.env, "OPENSEND_BASE_URL");
    } else {
      process.env.OPENSEND_BASE_URL = originalBaseUrl;
    }
  });
});
