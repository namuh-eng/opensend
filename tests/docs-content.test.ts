import { readFileSync } from "node:fs";
import path from "node:path";
import {
  docsHrefFromRelPath,
  extractHeadings,
  getAllDocs,
  getDocPage,
  getDocsNav,
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

    expect(nav.map((section) => section.id)).toContain("api-reference");
    expect(nav.map((section) => section.id)).toContain("operations");
    expect(page?.title).toBe("Self Hosting");
    expect(page?.href).toBe("/docs/self-hosting");
    expect(
      page?.headings.some((heading) => heading.text === "Reference topology"),
    ).toBe(true);
    expect(page?.markdown).toContain(
      "SES/SNS events should be delivered to the ingester service",
    );
  });

  it("keeps generated llms.txt on the OpenSend-owned hosted domain", () => {
    const llms = readFileSync(
      path.join(process.cwd(), "public/docs/llms.txt"),
      "utf8",
    );

    expect(llms).toContain(
      "https://opensend.namuh.co/docs/api-reference/introduction.md",
    );
    expect(llms).not.toContain("api.opensend.com");
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
});
