#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const docsRoot = path.join(process.cwd(), "public", "docs");
const competitorPatterns = [/resend\.com\/docs/i, /Resend docs/i];
const minApiReferenceWords = 30;
const minimumDepthPrefixes = [
  "api-reference/api-keys/",
  "api-reference/broadcasts/",
  "api-reference/contact-properties/",
  "api-reference/contacts/",
  "api-reference/domains/",
  "api-reference/emails/",
  "api-reference/events/",
  "api-reference/logs/",
  "api-reference/segments/",
  "api-reference/suppressions/",
  "api-reference/templates/",
  "api-reference/topics/",
  "api-reference/webhooks/",
];

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

function wordCount(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

const failures = [];
const markdownFiles = await walk(docsRoot);
for (const file of markdownFiles) {
  const relPath = path.relative(docsRoot, file).split(path.sep).join("/");
  const markdown = await readFile(file, "utf8");

  for (const pattern of competitorPatterns) {
    if (pattern.test(markdown)) {
      failures.push(
        `${relPath}: contains prohibited competitor-docs reference`,
      );
    }
  }

  const requiresMinimumDepth = minimumDepthPrefixes.some((prefix) =>
    relPath.startsWith(prefix),
  );
  if (requiresMinimumDepth && wordCount(markdown) < minApiReferenceWords) {
    failures.push(
      `${relPath}: API reference page is below ${minApiReferenceWords} words`,
    );
  }
}

if (failures.length > 0) {
  console.error("Docs quality check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Docs quality check passed for ${markdownFiles.length} pages.`);
