#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const SYNCED_PACKAGE_FILES = [
  "package.json",
  "packages/core/package.json",
  "packages/ingester/package.json",
];

const TAG_PATTERN = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

export function parseReleaseTag(tag) {
  const match = TAG_PATTERN.exec(tag);
  if (!match) {
    return {
      ok: false,
      version: null,
      problem: `tag "${tag}" is not a valid semver vX.Y.Z or vX.Y.Z-prerelease tag`,
    };
  }

  return { ok: true, version: match[1], problem: null };
}

export function releaseNotesPathForTag(repoRoot, tag) {
  return path.join(repoRoot, "docs", "release-notes", `${tag}.md`);
}

export function verifyReleaseVersionSync({
  repoRoot,
  tag,
  requireReleaseNotes = false,
}) {
  const parsed = parseReleaseTag(tag);
  const problems = [];

  if (!parsed.ok || parsed.version === null) {
    problems.push(parsed.problem ?? `invalid tag "${tag}"`);
  }

  const expected = parsed.version ?? tag.replace(/^v/, "");

  for (const rel of SYNCED_PACKAGE_FILES) {
    const pkgPath = path.join(repoRoot, rel);
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${rel} could not be read as JSON: ${message}`);
      continue;
    }

    if (pkg.version !== expected) {
      problems.push(
        `${rel} version (${pkg.version ?? "missing"}) does not match tag (${expected})`,
      );
    }
  }

  const releaseNotesPath = releaseNotesPathForTag(repoRoot, tag);
  if (requireReleaseNotes && !fs.existsSync(releaseNotesPath)) {
    problems.push(
      `release notes file is missing for ${tag}: ${path.relative(repoRoot, releaseNotesPath)}`,
    );
  }

  return {
    ok: problems.length === 0,
    tag,
    expectedVersion: expected,
    syncedPackageFiles: SYNCED_PACKAGE_FILES,
    releaseNotesPath,
    problems,
  };
}

function parseArgs(argv) {
  const options = {
    repoRoot: process.cwd(),
    tag: process.env.GITHUB_REF_NAME ?? "",
    requireReleaseNotes: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo-root") {
      options.repoRoot = argv[++i] ?? options.repoRoot;
    } else if (arg === "--tag") {
      options.tag = argv[++i] ?? options.tag;
    } else if (arg === "--require-release-notes") {
      options.requireReleaseNotes = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = verifyReleaseVersionSync(options);

    if (!result.ok) {
      for (const problem of result.problems) {
        console.error(`[version-sync] ${problem}`);
      }
      process.exit(1);
    }

    console.log(
      `[version-sync] OK tag=${result.tag} root/core/ingester=${result.expectedVersion}`,
    );
    console.log(
      "[version-sync] note: SDKs and other workspace packages keep independent release cadences and are not gated here.",
    );
    if (options.requireReleaseNotes) {
      console.log(
        `[version-sync] release notes=${path.relative(options.repoRoot, result.releaseNotesPath)}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[version-sync] ${message}`);
    process.exit(1);
  }
}
