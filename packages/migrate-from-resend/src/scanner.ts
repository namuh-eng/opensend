import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { compatibilityMatrix, unknownCompatibilityEntry } from "./matrix";
import type {
  CompatibilityEntry,
  DetectorKind,
  Finding,
  ScanOptions,
  ScanResult,
} from "./types";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const scanExtensions = new Set([
  ".cjs",
  ".cts",
  ".env",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".py",
  ".rb",
  ".ts",
  ".tsx",
  ".txt",
]);

function isScannableFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  if (basename.startsWith(".env")) return true;
  return scanExtensions.has(path.extname(filePath));
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(...(await walkFiles(path.join(dir, entry.name))));
      continue;
    }

    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    if (isScannableFile(fullPath)) files.push(fullPath);
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function lineAndColumn(
  source: string,
  index: number,
): { line: number; column: number } {
  const before = source.slice(0, index);
  const line = before.split(/\r?\n/).length;
  const lineStart = Math.max(
    before.lastIndexOf("\n"),
    before.lastIndexOf("\r"),
  );
  const column = index - lineStart;
  return { line, column };
}

function patternsFor(entry: CompatibilityEntry): readonly RegExp[] {
  if (
    entry.detectorKind === "sdk-call" ||
    entry.detectorKind === "sdk-import"
  ) {
    return entry.sdkPatterns ?? [];
  }
  if (entry.detectorKind === "rest-endpoint") return entry.restPatterns ?? [];
  return entry.envPatterns ?? [];
}

function matchEntries(source: string, relativePath: string): Finding[] {
  const findings: Finding[] = [];

  for (const entry of compatibilityMatrix) {
    for (const pattern of patternsFor(entry)) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const index = match.index ?? 0;
        findings.push({
          id: `${relativePath}:${index}:${entry.id}`,
          detectorKind: entry.detectorKind,
          location: { filePath: relativePath, ...lineAndColumn(source, index) },
          match: match[0],
          entry,
        });
      }
    }
  }

  findings.push(...matchUnknownSdkCalls(source, relativePath, findings));

  return findings;
}

function matchUnknownSdkCalls(
  source: string,
  relativePath: string,
  knownFindings: readonly Finding[],
): Finding[] {
  const unknownPattern =
    /\bresend\.[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*\(/g;
  const findings: Finding[] = [];
  for (const match of source.matchAll(unknownPattern)) {
    const index = match.index ?? 0;
    const matchText = match[0];
    const isKnownSameSpan = knownFindings.some((finding) => {
      if (finding.detectorKind !== "sdk-call") return false;
      if (finding.location.filePath !== relativePath) return false;
      const knownIndex = Number(finding.id.split(":").at(-2));
      if (!Number.isFinite(knownIndex)) return false;
      const knownEnd = knownIndex + finding.match.length;
      const unknownEnd = index + matchText.length;
      return index < knownEnd && knownIndex < unknownEnd;
    });
    if (isKnownSameSpan) continue;

    findings.push({
      id: `${relativePath}:${index}:${unknownCompatibilityEntry.id}`,
      detectorKind: "sdk-call",
      location: { filePath: relativePath, ...lineAndColumn(source, index) },
      match: matchText,
      entry: unknownCompatibilityEntry,
    });
  }

  return findings;
}

function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const file = a.location.filePath.localeCompare(b.location.filePath);
    if (file !== 0) return file;
    if (a.location.line !== b.location.line)
      return a.location.line - b.location.line;
    if (a.location.column !== b.location.column) {
      return a.location.column - b.location.column;
    }
    return a.entry.id.localeCompare(b.entry.id);
  });
}

export async function scanResendUsage(
  options: ScanOptions,
): Promise<ScanResult> {
  const cwd = options.cwd ?? process.cwd();
  const targetDir = path.resolve(cwd, options.targetDir);
  const targetStat = await stat(targetDir);
  if (!targetStat.isDirectory()) {
    throw new Error(`Target must be a directory: ${targetDir}`);
  }

  const files = await walkFiles(targetDir);
  const findings: Finding[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relativePath = path
      .relative(targetDir, file)
      .split(path.sep)
      .join("/");
    findings.push(...matchEntries(source, relativePath));
  }

  return {
    targetDir,
    scannedFiles: files.length,
    findings: sortFindings(findings),
    generatedAt: new Date().toISOString(),
  };
}

export function countFindingsByStatus(findings: readonly Finding[]) {
  return findings.reduce<
    Record<"full" | "partial" | "unsupported" | "unknown", number>
  >(
    (counts, finding) => {
      counts[finding.entry.status] += 1;
      return counts;
    },
    { full: 0, partial: 0, unsupported: 0, unknown: 0 },
  );
}

export function detectorKindLabel(kind: DetectorKind): string {
  switch (kind) {
    case "environment":
      return "environment";
    case "rest-endpoint":
      return "REST";
    case "sdk-call":
      return "SDK call";
    case "sdk-import":
      return "SDK import";
  }
}
