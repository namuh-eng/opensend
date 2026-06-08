import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type DocsNavItem = {
  title: string;
  summary: string;
  relPath: string;
  slug: string;
  href: string;
  rawHref: string;
};

export type DocsNavSection = {
  id: string;
  title: string;
  description: string;
  items: DocsNavItem[];
};

export type DocsHeading = {
  id: string;
  depth: 2 | 3;
  text: string;
};

export type DocsPage = DocsNavItem & {
  markdown: string;
  headings: DocsHeading[];
  previous: DocsNavItem | null;
  next: DocsNavItem | null;
};

const DOCS_ROOT = path.join(process.cwd(), "public", "docs");

const SECTION_META: Record<string, { title: string; description: string }> = {
  "start-here": {
    title: "Start here",
    description: "Quickstarts, SDKs, MCP, examples, and operating modes.",
  },
  "api-reference": {
    title: "API reference",
    description: "Authentication, errors, limits, and endpoint contracts.",
  },
  dashboard: {
    title: "Dashboard guides",
    description:
      "How to operate domains, audiences, templates, broadcasts, and logs.",
  },
  webhooks: {
    title: "Webhooks",
    description:
      "Signed event delivery, retries, replays, and lifecycle events.",
  },
  "knowledge-base": {
    title: "Knowledge base",
    description: "DNS providers, consent, deliverability, and troubleshooting.",
  },
  operations: {
    title: "Operations",
    description: "Self-hosting, ingester deploys, security, and observability.",
  },
};

const SECTION_ORDER = [
  "start-here",
  "api-reference",
  "dashboard",
  "webhooks",
  "knowledge-base",
  "operations",
];

const DOC_ORDER = [
  "api-reference/introduction.md",
  "api-reference/authentication.md",
  "api-reference/pagination.md",
  "api-reference/errors.md",
  "api-reference/rate-limit.md",
  "api-reference/receiving-routes.md",
  "sdks.md",
  "examples.md",
  "send-with-nodejs.md",
  "send-with-bun.md",
  "send-with-nextjs.md",
  "send-with-express.md",
  "send-with-hono.md",
  "send-with-cloudflare-workers.md",
  "send-with-aws-lambda.md",
  "send-with-vercel.md",
  "send-with-railway.md",
  "send-with-python.md",
  "send-with-fastapi.md",
  "send-with-flask.md",
  "send-with-django.md",
  "send-with-go.md",
  "send-with-ruby.md",
  "send-with-rails.md",
  "send-with-sinatra.md",
  "send-with-smtp.md",
  "integrations.md",
  "cli.md",
  "mcp-server.md",
  "ai-onboarding.md",
  "agent-email-inbox-skill.md",
  "dashboard/api-keys/introduction.md",
  "dashboard/emails/introduction.md",
  "dashboard/emails/attachments.md",
  "dashboard/emails/custom-headers.md",
  "dashboard/emails/email-bounces.md",
  "dashboard/emails/email-suppressions.md",
  "dashboard/emails/idempotency-keys.md",
  "dashboard/emails/schedule-email.md",
  "dashboard/emails/tags.md",
  "dashboard/broadcasts/introduction.md",
  "dashboard/broadcasts/performance-tracking.md",
  "dashboard/domains/introduction.md",
  "dashboard/domains/dmarc.md",
  "dashboard/domains/tracking.md",
  "dashboard/audiences/contacts.md",
  "dashboard/audiences/properties.md",
  "dashboard/audiences/managing-unsubscribe-list.md",
  "dashboard/segments/introduction.md",
  "dashboard/topics/introduction.md",
  "dashboard/templates/introduction.md",
  "dashboard/templates/template-variables.md",
  "dashboard/templates/version-history.md",
  "dashboard/automations/introduction.md",
  "dashboard/automations/trigger.md",
  "dashboard/automations/delay.md",
  "dashboard/automations/condition.md",
  "dashboard/automations/send-email.md",
  "dashboard/automations/wait-for-event.md",
  "dashboard/automations/runs.md",
  "dashboard/webhooks/introduction.md",
  "dashboard/suppressions/introduction.md",
  "dashboard/logs/introduction.md",
  "dashboard/receiving/introduction.md",
  "dashboard/receiving/custom-domains.md",
  "dashboard/receiving/routing.md",
  "dashboard/receiving/get-email-content.md",
  "dashboard/receiving/attachments.md",
  "dashboard/receiving/forward-emails.md",
  "dashboard/receiving/reply-to-emails.md",
  "react-email-skill.md",
  "email-best-practices-skill.md",
  "custom-event-schemas.md",
  "knowledge-base/spf-dkim-dmarc.md",
  "knowledge-base/what-if-my-domain-is-not-verifying.md",
  "knowledge-base/cloudflare.md",
  "knowledge-base/route53.md",
  "knowledge-base/namecheap.md",
  "knowledge-base/godaddy.md",
  "knowledge-base/mx-conflicts-receiving.md",
  "knowledge-base/why-are-my-emails-going-to-spam.md",
  "knowledge-base/warming-up.md",
  "knowledge-base/what-counts-as-email-consent.md",
  "knowledge-base/consent-unsubscribe-topics-suppressions.md",
  "knowledge-base/quotas-rate-limits-production-access.md",
  "knowledge-base/how-to-handle-api-keys.md",
  "knowledge-base/what-sending-feature-to-use.md",
  "knowledge-base/what-attachment-types-are-not-supported.md",
  "self-hosting.md",
  "ingester-deploy.md",
  "security.md",
  "privacy.md",
  "observability.md",
  "webhooks/introduction.md",
  "webhooks/event-types.md",
  "webhooks/verify-webhooks-requests.md",
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function slugFromRelPath(relPath: string) {
  return relPath.replace(/\.md$/, "");
}

export function relPathFromSlugParts(slugParts: string[]) {
  const joined = slugParts.join("/");
  if (!joined || joined.includes("..")) return null;
  if (joined.endsWith(".md")) return joined;
  return `${joined}.md`;
}

export function docsHrefFromRelPath(relPath: string) {
  return `/docs/${slugFromRelPath(relPath)}`;
}

export function normalizeDocsMarkdownHref(
  href: string,
  currentRelPath: string,
) {
  const trimmedHref = href.trim();
  if (
    !trimmedHref ||
    trimmedHref.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) ||
    trimmedHref.startsWith("//")
  ) {
    return href;
  }

  const [withoutHash, hash = ""] = trimmedHref.split("#", 2);
  const [withoutQuery, query = ""] = withoutHash.split("?", 2);

  if (withoutQuery.startsWith("/docs/") && withoutQuery.endsWith(".md")) {
    const normalizedPath = withoutQuery.replace(/\.md$/, "");
    return `${normalizedPath}${query ? `?${query}` : ""}${
      hash ? `#${hash}` : ""
    }`;
  }

  if (withoutQuery.endsWith(".md")) {
    const currentDir = path.posix.dirname(currentRelPath);
    const baseDir = currentDir === "." ? "" : currentDir;
    const resolvedRelPath = path.posix.normalize(
      path.posix.join(baseDir, withoutQuery),
    );

    if (
      !resolvedRelPath.startsWith("..") &&
      !path.posix.isAbsolute(resolvedRelPath)
    ) {
      return `${docsHrefFromRelPath(resolvedRelPath)}${
        query ? `?${query}` : ""
      }${hash ? `#${hash}` : ""}`;
    }
  }

  return href;
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleAndSummary(markdown: string, relPath: string) {
  const lines = markdown.split(/\r?\n/);
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  const titleLine = titleIndex >= 0 ? lines[titleIndex] : null;
  const title = titleLine ? cleanMarkdownText(titleLine.slice(2)) : relPath;
  const summary =
    lines
      .slice(titleIndex >= 0 ? titleIndex + 1 : 0)
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

function orderIndex(relPath: string) {
  const index = DOC_ORDER.indexOf(relPath);
  return index === -1 ? 10_000 : index;
}

function compareDocs(a: DocsNavItem, b: DocsNavItem) {
  const sectionDelta =
    SECTION_ORDER.indexOf(sectionIdForRelPath(a.relPath)) -
    SECTION_ORDER.indexOf(sectionIdForRelPath(b.relPath));
  if (sectionDelta !== 0) return sectionDelta;

  const orderDelta = orderIndex(a.relPath) - orderIndex(b.relPath);
  if (orderDelta !== 0) return orderDelta;

  return a.relPath.localeCompare(b.relPath);
}

function sectionIdForRelPath(relPath: string) {
  if (relPath.startsWith("api-reference/")) return "api-reference";
  if (relPath.startsWith("dashboard/")) return "dashboard";
  if (relPath.startsWith("webhooks/")) return "webhooks";
  if (relPath.startsWith("knowledge-base/")) return "knowledge-base";
  if (
    relPath === "self-hosting.md" ||
    relPath === "ingester-deploy.md" ||
    relPath === "observability.md" ||
    relPath === "privacy.md" ||
    relPath === "security.md"
  ) {
    return "operations";
  }
  return "start-here";
}

export function headingId(value: string) {
  return cleanMarkdownText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(markdown: string): DocsHeading[] {
  const seen = new Map<string, number>();
  const headings: DocsHeading[] = [];
  let inFence = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const depth = match[1].length as 2 | 3;
    const text = cleanMarkdownText(match[2]);
    const baseId = headingId(text) || "section";
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    headings.push({
      id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      depth,
      text,
    });
  }

  return headings;
}

export async function getAllDocs(): Promise<DocsNavItem[]> {
  const files = await walk(DOCS_ROOT);
  const docs: DocsNavItem[] = [];

  for (const file of files) {
    const relPath = path.relative(DOCS_ROOT, file).split(path.sep).join("/");
    const markdown = await readFile(file, "utf8");
    const { title, summary } = extractTitleAndSummary(markdown, relPath);
    const slug = slugFromRelPath(relPath);
    docs.push({
      title,
      summary,
      relPath,
      slug,
      href: docsHrefFromRelPath(relPath),
      rawHref: `/docs/${relPath}`,
    });
  }

  return docs.sort(compareDocs);
}

export async function getDocsNav(): Promise<DocsNavSection[]> {
  const docs = await getAllDocs();
  return SECTION_ORDER.map((id) => {
    const meta = SECTION_META[id];
    return {
      id,
      title: meta.title,
      description: meta.description,
      items: docs.filter((doc) => sectionIdForRelPath(doc.relPath) === id),
    };
  }).filter((section) => section.items.length > 0);
}

export async function getDocPage(relPath: string): Promise<DocsPage | null> {
  if (!relPath.endsWith(".md") || relPath.includes("..")) return null;
  const docs = await getAllDocs();
  const currentIndex = docs.findIndex((doc) => doc.relPath === relPath);
  if (currentIndex === -1) return null;

  const filePath = path.join(DOCS_ROOT, relPath);
  const markdown = await readFile(filePath, "utf8");
  return {
    ...docs[currentIndex],
    markdown,
    headings: extractHeadings(markdown),
    previous: currentIndex > 0 ? docs[currentIndex - 1] : null,
    next: currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null,
  };
}
