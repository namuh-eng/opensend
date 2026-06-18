import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve("tools/verify-release-version-sync.mjs");

function writePackageJson(repoRoot: string, relPath: string, version: string) {
  const fullPath = path.join(repoRoot, relPath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(
    fullPath,
    `${JSON.stringify({ name: relPath, version }, null, 2)}\n`,
  );
}

function makeFixture(version: string, releaseNoteTag = "v1.0.0") {
  const repoRoot = mkdtempSync(path.join(tmpdir(), "opensend-release-sync-"));
  writePackageJson(repoRoot, "package.json", version);
  writePackageJson(repoRoot, "packages/core/package.json", version);
  writePackageJson(repoRoot, "packages/ingester/package.json", version);
  const notesDir = path.join(repoRoot, "docs/release-notes");
  mkdirSync(notesDir, { recursive: true });
  writeFileSync(
    path.join(notesDir, `${releaseNoteTag}.md`),
    "# Release notes\n",
  );
  return repoRoot;
}

function runVersionCheck(repoRoot: string, tag: string) {
  return execFileSync(
    "node",
    [
      scriptPath,
      "--repo-root",
      repoRoot,
      "--tag",
      tag,
      "--require-release-notes",
    ],
    { encoding: "utf8" },
  );
}

describe("verify-release-version-sync", () => {
  it("accepts a stable v1.0.0 tag when gated package versions and notes match", () => {
    const output = runVersionCheck(makeFixture("1.0.0"), "v1.0.0");

    expect(output).toContain("root/core/ingester=1.0.0");
    expect(output).toContain("release notes=docs/release-notes/v1.0.0.md");
  });

  it("rejects mismatched stable tags", () => {
    const repoRoot = makeFixture("1.0.0", "v1.0.1");

    expect(() => runVersionCheck(repoRoot, "v1.0.1")).toThrow(
      /does not match tag \(1\.0\.1\)/,
    );
  });

  it("requires prerelease tags to match prerelease package versions exactly", () => {
    expect(() => runVersionCheck(makeFixture("1.0.0"), "v1.0.0-rc.1")).toThrow(
      /does not match tag \(1\.0\.0-rc\.1\)/,
    );

    const output = runVersionCheck(
      makeFixture("1.0.0-rc.1", "v1.0.0-rc.1"),
      "v1.0.0-rc.1",
    );
    expect(output).toContain("root/core/ingester=1.0.0-rc.1");
  });
});
