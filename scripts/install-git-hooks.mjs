#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const hooksDir = path.join(repoRoot, ".githooks");
const hookFiles = ["pre-commit", "pre-push"];

if (!existsSync(path.join(repoRoot, ".git")) || !existsSync(hooksDir)) {
  process.exit(0);
}

const topLevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();

if (topLevel !== repoRoot) {
  process.exit(0);
}

for (const hookFile of hookFiles) {
  const hookPath = path.join(hooksDir, hookFile);
  if (existsSync(hookPath)) {
    chmodSync(hookPath, 0o755);
  }
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "ignore",
});

console.log("✓ Installed Opensend git hooks (.githooks)");
