import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  docsHrefFromRelPath,
  extractHeadings,
  getAllDocs,
  getDocPage,
  getDocsNav,
  normalizeDocsMarkdownHref,
  relPathFromSlugParts,
} from "@/lib/docs";
import { describe, expect, it } from "vitest";

describe("docs content shell", () => {
  it("builds pretty human docs routes while preserving raw markdown paths", async () => {
    const docs = await getAllDocs();
    const sendDoc = docs.find(
      (doc) => doc.relPath === "api-reference/emails/send-email.md",
    );

    expect(sendDoc).toBeDefined();
    expect(sendDoc?.href).toBe("/docs/api-reference/emails/send-email");
    expect(sendDoc?.rawHref).toBe("/docs/api-reference/emails/send-email.md");
    expect(docsHrefFromRelPath("self-hosting.md")).toBe("/docs/self-hosting");
    expect(relPathFromSlugParts(["self-hosting"])).toBe("self-hosting.md");
    expect(
      relPathFromSlugParts(["api-reference", "emails", "send-email"]),
    ).toBe("api-reference/emails/send-email.md");
  });

  it("groups docs into navigable sections with a rendered page payload", async () => {
    const nav = await getDocsNav();
    const page = await getDocPage("self-hosting.md");
    const startHereItems =
      nav.find((section) => section.id === "start-here")?.items ?? [];

    expect(nav.map((section) => section.id)).toContain("api-reference");
    expect(nav.map((section) => section.id)).toContain("operations");
    expect(startHereItems.slice(0, 6).map((item) => item.relPath)).toEqual([
      "sdks.md",
      "examples.md",
      "send-with-nodejs.md",
      "send-with-bun.md",
      "send-with-nextjs.md",
      "send-with-express.md",
    ]);
    expect(page?.title).toBe("Self Hosting");
    expect(page?.href).toBe("/docs/self-hosting");
    expect(
      page?.headings.some((heading) => heading.text === "Reference topology"),
    ).toBe(true);
    expect(page?.markdown).toContain(
      "SES/SNS events should be delivered to the ingester service",
    );
  });

  it("keeps generated llms.txt on the OpenSend-owned hosted domain and docs order", () => {
    const llms = readFileSync(
      path.join(process.cwd(), "public/docs/llms.txt"),
      "utf8",
    );

    expect(llms).toContain(
      "https://opensend.namuh.co/docs/api-reference/introduction.md",
    );
    expect(llms).not.toContain("api.opensend.com");
    expect(llms.indexOf("/docs/sdks.md")).toBeLessThan(
      llms.indexOf("/docs/examples.md"),
    );
    expect(llms.indexOf("/docs/examples.md")).toBeLessThan(
      llms.indexOf("/docs/send-with-nodejs.md"),
    );
    expect(llms).toContain("/docs/send-with-cloudflare-workers.md");
    expect(llms).toContain("/docs/send-with-fastapi.md");
    expect(llms).toContain("/docs/send-with-rails.md");
    expect(llms.indexOf("/docs/webhooks/introduction.md")).toBeLessThan(
      llms.indexOf("/docs/webhooks/emails/sent.md"),
    );
  });

  it("normalizes markdown doc links to styled human docs routes", () => {
    expect(
      normalizeDocsMarkdownHref("./send-with-nodejs.md", "examples.md"),
    ).toBe("/docs/send-with-nodejs");
    expect(
      normalizeDocsMarkdownHref(
        "../authentication.md#api-keys",
        "api-reference/emails/send-email.md",
      ),
    ).toBe("/docs/api-reference/authentication#api-keys");
    expect(
      normalizeDocsMarkdownHref("/docs/self-hosting.md", "examples.md"),
    ).toBe("/docs/self-hosting");
    expect(normalizeDocsMarkdownHref("#setup", "examples.md")).toBe("#setup");
    expect(
      normalizeDocsMarkdownHref(
        "https://github.com/namuh-eng/opensend",
        "examples.md",
      ),
    ).toBe("https://github.com/namuh-eng/opensend");
  });

  it("extracts unique heading anchors for table of contents", () => {
    const headings = extractHeadings(
      "# Title\n\n## Setup\n\n### DNS\n\n## Setup\n",
    );

    expect(headings).toEqual([
      { depth: 2, id: "setup", text: "Setup" },
      { depth: 3, id: "dns", text: "DNS" },
      { depth: 2, id: "setup-2", text: "Setup" },
    ]);
  });

  it("keeps Python examples copy-pasteable when they use environment variables", () => {
    const docsRoot = path.join(process.cwd(), "public/docs");
    const markdownFiles = listMarkdownFiles(docsRoot);

    for (const file of markdownFiles) {
      const markdown = readFileSync(file, "utf8");
      const pythonBlocks = markdown.matchAll(
        /```(?:py|python)\n([\s\S]*?)\n```/g,
      );

      for (const match of pythonBlocks) {
        const code = match[1];
        if (code.includes("os.environ")) {
          expect(code).toContain("import os");
        }
      }
    }
  });

  it("documents first-party SDK and framework guides without implying unsupported packages", () => {
    const docsRoot = path.join(process.cwd(), "public/docs");
    const requiredGuides = [
      "send-with-cloudflare-workers.md",
      "send-with-aws-lambda.md",
      "send-with-vercel.md",
      "send-with-railway.md",
      "send-with-fastapi.md",
      "send-with-flask.md",
      "send-with-django.md",
      "send-with-rails.md",
      "send-with-sinatra.md",
    ];

    for (const guide of requiredGuides) {
      const markdown = readFileSync(path.join(docsRoot, guide), "utf8");
      expect(markdown).toContain("OPENSEND_API_KEY");
      expect(markdown).not.toContain("resend.com/docs");
    }

    const sdks = readFileSync(path.join(docsRoot, "sdks.md"), "utf8");
    expect(sdks).toContain("v0.2.0");
    expect(sdks).toContain("install from the repo until PyPI");
    expect(sdks).toContain("install from the repo until RubyGems");
    expect(sdks).not.toMatch(/PHP SDK|Java SDK|\\.NET SDK|Rust SDK/);
  });

  it("documents implemented dashboard product areas with caveats", () => {
    const docsRoot = path.join(process.cwd(), "public/docs");
    const requiredDashboardDocs = [
      "dashboard/emails/introduction.md",
      "dashboard/broadcasts/introduction.md",
      "dashboard/domains/introduction.md",
      "dashboard/automations/introduction.md",
      "dashboard/templates/introduction.md",
      "dashboard/audiences/contacts.md",
      "dashboard/segments/introduction.md",
      "dashboard/topics/introduction.md",
      "dashboard/webhooks/introduction.md",
      "dashboard/suppressions/introduction.md",
      "dashboard/logs/introduction.md",
    ];

    for (const relPath of requiredDashboardDocs) {
      const markdown = readFileSync(path.join(docsRoot, relPath), "utf8");
      expect(markdown.split(/\s+/).length).toBeGreaterThan(80);
      expect(markdown).not.toContain("resend.com/docs");
    }

    const suppressions = readFileSync(
      path.join(docsRoot, "dashboard/suppressions/introduction.md"),
      "utf8",
    );
    expect(suppressions).toContain(
      "There is not a separate full suppressions dashboard page",
    );
  });

  it("documents deliverability and support knowledge-base guidance", () => {
    const docsRoot = path.join(process.cwd(), "public/docs");
    const requiredKbDocs = [
      "knowledge-base/spf-dkim-dmarc.md",
      "knowledge-base/why-are-my-emails-going-to-spam.md",
      "knowledge-base/mx-conflicts-receiving.md",
      "knowledge-base/consent-unsubscribe-topics-suppressions.md",
      "knowledge-base/quotas-rate-limits-production-access.md",
      "knowledge-base/how-to-handle-api-keys.md",
    ];

    for (const relPath of requiredKbDocs) {
      const markdown = readFileSync(path.join(docsRoot, relPath), "utf8");
      expect(markdown.split(/\s+/).length).toBeGreaterThan(90);
      expect(markdown).not.toContain("resend.com/docs");
    }

    const quotas = readFileSync(
      path.join(
        docsRoot,
        "knowledge-base/quotas-rate-limits-production-access.md",
      ),
      "utf8",
    );
    expect(quotas).toContain("Single email sends: 20 POST requests per minute");
    expect(quotas).toContain("Batch email sends: 5 POST requests per minute");
  });
});

function listMarkdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
    return [];
  });
}

describe("webhook event docs", () => {
  it("documents every supported webhook subscription event in public docs", async () => {
    const { SUPPORTED_WEBHOOK_EVENT_TYPES } = await import(
      "@opensend/core/src/webhook-events"
    );
    const docsRoot = path.join(process.cwd(), "public/docs/webhooks");

    const eventDocPath = (eventType: string) => {
      const [resource, action] = eventType.split(".") as [string, string];
      const folder = `${resource}s`;
      const file = `${action.replaceAll("_", "-")}.md`;
      return path.join(docsRoot, folder, file);
    };

    for (const eventType of SUPPORTED_WEBHOOK_EVENT_TYPES) {
      const markdown = readFileSync(eventDocPath(eventType), "utf8");
      expect(markdown).toContain(`# ${eventType}`);
      expect(markdown).toContain("## When it is emitted");
      expect(markdown).toContain("svix-signature");
    }

    const eventTypes = readFileSync(
      path.join(docsRoot, "event-types.md"),
      "utf8",
    );
    for (const eventType of SUPPORTED_WEBHOOK_EVENT_TYPES) {
      expect(eventTypes).toContain(`\`${eventType}\``);
    }
    expect(eventTypes).toContain("email.received");
    expect(eventTypes).toContain(
      "not part of the default webhook subscription",
    );
  });
});
