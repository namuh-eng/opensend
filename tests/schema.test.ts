import {
  apiKeys,
  broadcasts,
  contacts,
  domains,
  emails,
  logs,
  segments,
  templates,
  topics,
  webhooks,
  workspaceEntitlements,
  workspaceInvitations,
  workspaceMemberships,
  workspaces,
} from "@/lib/db/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("Database schema", () => {
  describe("Tables exist with correct names", () => {
    it("defines all required tables", () => {
      expect(getTableName(domains)).toBe("domains");
      expect(getTableName(apiKeys)).toBe("api_keys");
      expect(getTableName(emails)).toBe("emails");
      expect(getTableName(segments)).toBe("segments");
      expect(getTableName(topics)).toBe("topics");
      expect(getTableName(contacts)).toBe("contacts");
      expect(getTableName(broadcasts)).toBe("broadcasts");
      expect(getTableName(webhooks)).toBe("webhooks");
      expect(getTableName(templates)).toBe("templates");
      expect(getTableName(logs)).toBe("logs");
      expect(getTableName(workspaces)).toBe("workspaces");
      expect(getTableName(workspaceMemberships)).toBe("workspace_memberships");
      expect(getTableName(workspaceInvitations)).toBe("workspace_invitations");
      expect(getTableName(workspaceEntitlements)).toBe(
        "workspace_entitlements",
      );
    });
  });

  describe("Workspace foundation columns", () => {
    it("stores workspace ownership, memberships, invitations, and entitlement checks", () => {
      const workspaceCols = getTableColumns(workspaces);
      expect(workspaceCols.id).toBeDefined();
      expect(workspaceCols.name).toBeDefined();
      expect(workspaceCols.ownerUserId.notNull).toBe(true);

      const membershipCols = getTableColumns(workspaceMemberships);
      expect(membershipCols.workspaceId.notNull).toBe(true);
      expect(membershipCols.userId.notNull).toBe(true);
      expect(membershipCols.role.notNull).toBe(true);

      const invitationCols = getTableColumns(workspaceInvitations);
      expect(invitationCols.workspaceId.notNull).toBe(true);
      expect(invitationCols.email.notNull).toBe(true);
      expect(invitationCols.role.notNull).toBe(true);
      expect(invitationCols.tokenHash.notNull).toBe(true);
      expect(invitationCols.expiresAt.notNull).toBe(true);

      const entitlementCols = getTableColumns(workspaceEntitlements);
      expect(entitlementCols.workspaceId.notNull).toBe(true);
      expect(entitlementCols.key.notNull).toBe(true);
      expect(entitlementCols.enabled.notNull).toBe(true);
      expect(entitlementCols.limit).toBeDefined();
    });
  });

  describe("Emails table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(emails);
      expect(cols.id).toBeDefined();
      expect(cols.from).toBeDefined();
      expect(cols.to).toBeDefined();
      expect(cols.cc).toBeDefined();
      expect(cols.bcc).toBeDefined();
      expect(cols.replyTo).toBeDefined();
      expect(cols.subject).toBeDefined();
      expect(cols.html).toBeDefined();
      expect(cols.text).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.tags).toBeDefined();
      expect(cols.headers).toBeDefined();
      expect(cols.attachments).toBeDefined();
      expect(cols.scheduledAt).toBeDefined();
      expect(cols.sentAt).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });

    it("from and subject are not nullable", () => {
      const cols = getTableColumns(emails);
      expect(cols.from.notNull).toBe(true);
      expect(cols.subject.notNull).toBe(true);
    });

    it("does not have apiKeyId or domainId columns", () => {
      const cols = getTableColumns(emails);
      expect((cols as Record<string, unknown>).apiKeyId).toBeUndefined();
      expect((cols as Record<string, unknown>).domainId).toBeUndefined();
    });
  });

  describe("Domains table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(domains);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.region).toBeDefined();
      expect(cols.dkimTokens).toBeDefined();
      expect(cols.records).toBeDefined();
      expect(cols.trackClicks).toBeDefined();
      expect(cols.trackOpens).toBeDefined();
      expect(cols.tls).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });

    it("name is not nullable", () => {
      const cols = getTableColumns(domains);
      expect(cols.name.notNull).toBe(true);
    });
  });

  describe("API Keys table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(apiKeys);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.tokenHash).toBeDefined();
      expect(cols.tokenPreview).toBeDefined();
      expect(cols.permission).toBeDefined();
      expect(cols.domain).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });

    it("tokenHash is not nullable", () => {
      const cols = getTableColumns(apiKeys);
      expect(cols.tokenHash.notNull).toBe(true);
    });
  });

  describe("Contacts table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(contacts);
      expect(cols.id).toBeDefined();
      expect(cols.email).toBeDefined();
      expect(cols.firstName).toBeDefined();
      expect(cols.lastName).toBeDefined();
      expect(cols.unsubscribed).toBeDefined();
      expect(cols.customProperties).toBeDefined();
      expect(cols.segments).toBeDefined();
      expect(cols.topicSubscriptions).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });

  describe("Broadcasts table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(broadcasts);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.from).toBeDefined();
      expect(cols.subject).toBeDefined();
      expect(cols.html).toBeDefined();
      expect(cols.replyTo).toBeDefined();
      expect(cols.previewText).toBeDefined();
      expect(cols.audienceId).toBeDefined();
      expect(cols.topicId).toBeDefined();
      expect(cols.scheduledAt).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });

  describe("Webhooks table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(webhooks);
      expect(cols.id).toBeDefined();
      expect(cols.url).toBeDefined();
      expect(cols.eventTypes).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });

    it("url is not nullable", () => {
      const cols = getTableColumns(webhooks);
      expect(cols.url.notNull).toBe(true);
    });
  });

  describe("Templates table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(templates);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.alias).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.from).toBeDefined();
      expect(cols.subject).toBeDefined();
      expect(cols.html).toBeDefined();
      expect(cols.text).toBeDefined();
      expect(cols.variables).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });

  describe("Logs table columns", () => {
    it("has all required columns for API request logging", () => {
      const cols = getTableColumns(logs);
      expect(cols.id).toBeDefined();
      expect(cols.endpoint).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.method).toBeDefined();
      expect(cols.userAgent).toBeDefined();
      expect(cols.requestBody).toBeDefined();
      expect(cols.responseBody).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });

  describe("Segments table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(segments);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.contactsCount).toBeDefined();
      expect(cols.unsubscribedCount).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });

  describe("Topics table columns", () => {
    it("has all required columns", () => {
      const cols = getTableColumns(topics);
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.description).toBeDefined();
      expect(cols.defaultSubscription).toBeDefined();
      expect(cols.visibility).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.document).toBeDefined();
    });
  });
});
