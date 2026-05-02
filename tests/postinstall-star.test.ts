// ABOUTME: Tests for the post-install GitHub star prompt script.
// ABOUTME: Uses fake gh binaries via GH_CMD injection and __FORCE_INTERACTIVE for TTY bypass.

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "..", "scripts", "postinstall-star.sh");

describe("postinstall-star", () => {
  const tmp = join(tmpdir(), `star-test-${Date.now()}`);

  const fakeGhOk = join(tmp, "gh-ok");
  const fakeGhUnauth = join(tmp, "gh-unauth");
  const fakeGhApiFail = join(tmp, "gh-api-fail");

  beforeAll(() => {
    mkdirSync(tmp, { recursive: true });

    // gh that is authenticated and API succeeds
    writeFileSync(
      fakeGhOk,
      '#!/bin/bash\nif [[ "$1" == "auth" && "$2" == "status" ]]; then exit 0; fi\nif [[ "$1" == "api" ]]; then exit 0; fi\nexit 1\n',
    );
    chmodSync(fakeGhOk, 0o755);

    // gh that is NOT authenticated
    writeFileSync(
      fakeGhUnauth,
      '#!/bin/bash\nif [[ "$1" == "auth" && "$2" == "status" ]]; then exit 1; fi\nexit 1\n',
    );
    chmodSync(fakeGhUnauth, 0o755);

    // gh that is authenticated but API call fails
    writeFileSync(
      fakeGhApiFail,
      '#!/bin/bash\nif [[ "$1" == "auth" && "$2" == "status" ]]; then exit 0; fi\nif [[ "$1" == "api" ]]; then exit 1; fi\nexit 1\n',
    );
    chmodSync(fakeGhApiFail, 0o755);
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function run(
    options: {
      env?: Record<string, string>;
      input?: string;
      args?: string[];
    } = {},
  ): { stdout: string; exitCode: number } {
    const { env = {}, input = "", args = [] } = options;
    // Strip ambient skip vars from the inherited environment so CI runners
    // (which set SKIP_STAR_PROMPT=1 at the job level for bun install) cannot
    // make the script short-circuit before the test asserts on its output.
    // Tests that want the skip behavior set the var explicitly via `env`.
    const {
      SKIP_STAR_PROMPT: _skip,
      OPENSEND_SKIP_STAR_PROMPT: _oskip,
      ...inherited
    } = process.env;
    try {
      const stdout = execFileSync("bash", [SCRIPT, ...args], {
        env: { ...inherited, ...env },
        input,
        encoding: "utf-8",
        timeout: 30000,
      });
      return { stdout, exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; status?: number };
      return { stdout: e.stdout || "", exitCode: e.status ?? 1 };
    }
  }

  it("exits 0 in non-interactive mode (piped stdin)", () => {
    const result = run({ env: { GH_CMD: fakeGhOk } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 when SKIP_STAR_PROMPT=1", () => {
    const result = run({
      env: {
        SKIP_STAR_PROMPT: "1",
        __FORCE_INTERACTIVE: "1",
        GH_CMD: fakeGhOk,
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 when OPENSEND_SKIP_STAR_PROMPT=1", () => {
    const result = run({
      env: {
        OPENSEND_SKIP_STAR_PROMPT: "1",
        __FORCE_INTERACTIVE: "1",
        GH_CMD: fakeGhOk,
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 with --skip-star-prompt flag", () => {
    const result = run({
      args: ["--skip-star-prompt"],
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhOk },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 when gh is not authenticated", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhUnauth },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("exits 0 when gh is not installed", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: "/nonexistent/gh-binary" },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("stars repo when user answers y", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhOk },
      input: "y\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Thanks for starring");
  });

  it("stars repo when user answers YES (case-insensitive)", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhOk },
      input: "YES\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Thanks for starring");
  });

  it("skips when user answers n", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhOk },
      input: "n\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Thanks for starring");
  });

  it("skips when user presses enter (empty — default No)", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhOk },
      input: "\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("Thanks for starring");
  });

  it("does not fail install when gh API fails", () => {
    const result = run({
      env: { __FORCE_INTERACTIVE: "1", GH_CMD: fakeGhApiFail },
      input: "y\n",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("continuing without it");
  });
});
