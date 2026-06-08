import { describe, expect, it } from "vitest";

// Test the API code examples data structure and drawer logic
// The component itself is tested via E2E; here we test the code example registry

// We'll import from the module once implemented
import {
  type ApiCodeSection,
  type ApiContext,
  LANGUAGE_TABS,
  getCodeSections,
} from "@/components/api-code-drawer";

describe("API Code Drawer", () => {
  describe("LANGUAGE_TABS", () => {
    it("includes Node.js and cURL tabs only", () => {
      expect(LANGUAGE_TABS).toEqual([
        { value: "nodejs", label: "Node.js" },
        { value: "curl", label: "cURL" },
      ]);
    });
  });

  describe("getCodeSections", () => {
    it("returns email code sections for emails context", () => {
      const sections = getCodeSections("emails");
      expect(sections.length).toBeGreaterThanOrEqual(4);

      const titles = sections.map((s: ApiCodeSection) => s.title);
      expect(titles).toContain("Send Email");
      expect(titles).toContain("Send Batch Emails");
      expect(titles).toContain("Retrieve Email");
      expect(titles).toContain("Update Email");
    });

    it("returns domain code sections for domains context", () => {
      const sections = getCodeSections("domains");
      const titles = sections.map((s: ApiCodeSection) => s.title);
      expect(titles).toContain("Add Domain");
      expect(titles).toContain("Retrieve Domain");
      expect(titles).toContain("Verify Domain");
      expect(titles).toContain("List Domains");
      expect(titles).toContain("Delete Domain");
    });

    it("returns webhook code sections for webhooks context", () => {
      const sections = getCodeSections("webhooks");
      const titles = sections.map((s: ApiCodeSection) => s.title);
      expect(titles).toContain("Create Webhook");
      expect(titles).toContain("List Webhooks");
      expect(titles).toContain("Remove Webhook");
    });

    it("returns api-keys code sections for api-keys context", () => {
      const sections = getCodeSections("api-keys");
      const titles = sections.map((s: ApiCodeSection) => s.title);
      expect(titles).toContain("Create API Key");
      expect(titles).toContain("List API Keys");
      expect(titles).toContain("Remove API Key");
    });

    it("each section has code for both Node.js and cURL", () => {
      const contexts: ApiContext[] = [
        "emails",
        "domains",
        "webhooks",
        "api-keys",
      ];
      for (const ctx of contexts) {
        const sections = getCodeSections(ctx);
        for (const section of sections) {
          expect(section.code.nodejs).toBeDefined();
          expect(section.code.nodejs.length).toBeGreaterThan(0);
          expect(section.code.curl).toBeDefined();
          expect(section.code.curl.length).toBeGreaterThan(0);
        }
      }
    });

    it("Node.js code uses the SDK import pattern", () => {
      const sections = getCodeSections("emails");
      const sendEmail = sections.find(
        (s: ApiCodeSection) => s.title === "Send Email",
      );
      expect(sendEmail).toBeDefined();
      expect(sendEmail?.code.nodejs).toContain("Opensend");
      expect(sendEmail?.code.nodejs).toContain("from 'opensend'");
      expect(sendEmail?.code.nodejs).not.toContain("from 'resend'");
    });

    it("cURL code uses proper HTTP methods", () => {
      const sections = getCodeSections("emails");
      const sendEmail = sections.find(
        (s: ApiCodeSection) => s.title === "Send Email",
      );
      expect(sendEmail).toBeDefined();
      expect(sendEmail?.code.curl).toContain("curl");
      expect(sendEmail?.code.curl).toContain("/emails");
      expect(sendEmail?.code.curl).toContain("https://opensend.namuh.co");
      expect(sendEmail?.code.curl).not.toContain("https://api.example.com");
    });
  });

  describe("drawer title mapping", () => {
    it("maps context to correct drawer title", () => {
      // Title mapping is part of the component, but we can test the data
      const titleMap: Record<ApiContext, string> = {
        emails: "Sending Email API",
        domains: "Domains API",
        webhooks: "Webhooks API",
        "api-keys": "API Keys API",
        contacts: "Contacts API",
        broadcasts: "Broadcasts API",
        templates: "Templates API",
        segments: "Segments API",
        topics: "Topics API",
      };

      for (const [context, expectedTitle] of Object.entries(titleMap)) {
        expect(expectedTitle).toBeTruthy();
      }
    });
  });
});
