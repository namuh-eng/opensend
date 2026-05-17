#!/usr/bin/env node
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const docsRoot = path.join(process.cwd(), "public", "docs");
const publicBaseUrl =
  process.env.OPENSEND_DOCS_PUBLIC_BASE_URL ?? "https://opensend.namuh.co/docs";

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "llms.txt"
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function cleanMarkdownText(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleAndSummary(markdown, relPath) {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("# "));
  const title = titleLine ? cleanMarkdownText(titleLine.slice(2)) : relPath;
  const summary =
    lines
      .slice(titleLine ? lines.indexOf(titleLine) + 1 : 0)
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.startsWith("#") &&
          !line.startsWith("`") &&
          !line.startsWith("---") &&
          !line.startsWith("<!--"),
      ) ?? "OpenSend documentation.";

  return { title, summary: cleanMarkdownText(summary) };
}

function sortDocs(a, b) {
  const order = [
    "api-reference/introduction.md",
    "api-reference/authentication.md",
    "api-reference/pagination.md",
    "api-reference/errors.md",
    "api-reference/rate-limit.md",
  ];
  const ai = order.indexOf(a.relPath);
  const bi = order.indexOf(b.relPath);
  if (ai !== -1 || bi !== -1)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return a.relPath.localeCompare(b.relPath);
}

const markdownFiles = (await walk(docsRoot)).sort();
const docs = [];
for (const file of markdownFiles) {
  const relPath = path.relative(docsRoot, file).split(path.sep).join("/");
  const markdown = await readFile(file, "utf8");
  const { title, summary } = extractTitleAndSummary(markdown, relPath);
  docs.push({ relPath, title, summary });
}

docs.sort(sortDocs);

const lines = ["# OpenSend", "", "## Docs", ""];
for (const doc of docs) {
  lines.push(
    `- [${doc.title}](${publicBaseUrl}/${doc.relPath}): ${doc.summary}`,
  );
}
lines.push(
  "",
  "## OpenAPI Specs",
  "",
  "- [OpenAPI JSON](https://opensend.namuh.co/openapi.json)",
  "- [LLM Docs Index](https://opensend.namuh.co/docs/llms.txt)",
  "",
  "## Agent guidance",
  "",
  "Use these OpenSend-owned markdown files as the source of truth before generating code. Prefer `/openapi.json` for exact schemas and route availability. Do not route users to third-party docs from OpenSend public documentation.",
);

await writeFile(path.join(docsRoot, "llms.txt"), `${lines.join("\n")}\n`);
console.log(`Indexed ${docs.length} markdown docs in public/docs/llms.txt`);
