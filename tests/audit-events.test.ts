import { describe, expect, it } from "vitest";
import {
  type AuditEventRepository,
  createAuditEventService,
  sanitizeAuditMetadata,
} from "../packages/core/src/services/auditEvents";

type AuditEventRow = Awaited<ReturnType<AuditEventRepository["create"]>>;
type AuditEventInsert = Parameters<AuditEventRepository["create"]>[0];
type ListOptions = Parameters<AuditEventRepository["listForUser"]>[0];

function createRow(data: AuditEventInsert): AuditEventRow {
  return {
    id: "audit-1",
    userId: data.userId,
    actorType: data.actorType,
    actorId: data.actorId,
    actorEmail: data.actorEmail ?? null,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    source: data.source,
    sourceApiKeyId: data.sourceApiKeyId ?? null,
    metadata: data.metadata ?? null,
    createdAt: new Date("2026-05-11T00:00:00.000Z"),
  } satisfies AuditEventRow;
}

describe("audit event service", () => {
  it("redacts API keys, tokens, secrets, cookies, auth headers, and body fields", () => {
    const sanitized = sanitizeAuditMetadata({
      name: "Primary",
      apiKey: "os_plaintext",
      token: "tok_plaintext",
      authorization: "Bearer os_plaintext",
      cookie: "better-auth.session_token=value",
      signingSecret: "whsec_plaintext",
      nested: {
        password: "pw",
        html: "<p>body</p>",
        content: "attachment body",
        safe: "kept",
      },
    });

    expect(sanitized).toEqual({
      name: "Primary",
      apiKey: "[REDACTED]",
      token: "[REDACTED]",
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      signingSecret: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        html: "[REDACTED]",
        content: "[REDACTED]",
        safe: "kept",
      },
    });
  });

  it("persists required actor/action/target/source fields with sanitized metadata", async () => {
    let inserted: AuditEventInsert | null = null;
    const repository: AuditEventRepository = {
      async create(data) {
        inserted = data;
        return createRow(data);
      },
      async listForUser() {
        return [];
      },
    };

    const service = createAuditEventService({ repository });
    const event = await service.recordEvent({
      userId: "user-1",
      actor: { type: "api_key", id: "caller-key" },
      action: "api_key.created",
      target: { type: "api_key", id: "created-key" },
      source: "api_key",
      sourceApiKeyId: "caller-key",
      metadata: {
        name: "Created key",
        token: "os_plaintext",
        tokenHash: "hash_plaintext",
      },
    });

    expect(event).toMatchObject({
      userId: "user-1",
      actorType: "api_key",
      actorId: "caller-key",
      action: "api_key.created",
      targetType: "api_key",
      targetId: "created-key",
      source: "api_key",
      sourceApiKeyId: "caller-key",
    });
    expect(inserted).toMatchObject({
      userId: "user-1",
      actorType: "api_key",
      actorId: "caller-key",
      action: "api_key.created",
      targetType: "api_key",
      targetId: "created-key",
      source: "api_key",
      sourceApiKeyId: "caller-key",
      metadata: {
        name: "Created key",
        token: "[REDACTED]",
        tokenHash: "[REDACTED]",
      },
    });
    expect(JSON.stringify(inserted)).not.toContain("os_plaintext");
    expect(JSON.stringify(inserted)).not.toContain("hash_plaintext");
  });

  it("lists only events for the requested tenant and normalizes filters", async () => {
    const observed: { value?: ListOptions } = {};
    const userEvent = createRow({
      userId: "user-1",
      actorType: "user",
      actorId: "user-1",
      actorEmail: "user@example.com",
      action: "domain.updated",
      targetType: "domain",
      targetId: "domain-1",
      source: "dashboard",
      metadata: { name: "example.com" },
    });
    const otherTenantEvent = createRow({
      userId: "user-2",
      actorType: "user",
      actorId: "user-2",
      action: "domain.updated",
      targetType: "domain",
      targetId: "domain-2",
      source: "dashboard",
    });
    const repository: AuditEventRepository = {
      async create(data) {
        return createRow(data);
      },
      async listForUser(options) {
        observed.value = options;
        return [userEvent, otherTenantEvent].filter(
          (event) => event.userId === options.userId,
        );
      },
    };

    const service = createAuditEventService({ repository });
    const events = await service.listEvents({
      userId: "user-1",
      limit: 999,
      action: "domain.updated",
      targetType: "domain",
      source: "dashboard",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-11",
      search: "example",
    });

    expect(events).toEqual([userEvent]);
    const observedOptions = observed.value;
    expect(observedOptions).toBeDefined();
    if (!observedOptions) throw new Error("expected list options");
    expect(observedOptions).toMatchObject({
      userId: "user-1",
      limit: 500,
      action: "domain.updated",
      targetType: "domain",
      source: "dashboard",
      search: "example",
    });
    expect(observedOptions.dateFrom?.getFullYear()).toBe(2026);
    expect(observedOptions.dateFrom?.getMonth()).toBe(4);
    expect(observedOptions.dateFrom?.getDate()).toBe(1);
    expect(observedOptions.dateTo?.getFullYear()).toBe(2026);
    expect(observedOptions.dateTo?.getMonth()).toBe(4);
    expect(observedOptions.dateTo?.getDate()).toBe(11);
    expect(observedOptions.dateTo?.getHours()).toBe(23);
    expect(observedOptions.dateTo?.getMinutes()).toBe(59);
    expect(observedOptions.dateTo?.getSeconds()).toBe(59);
    expect(observedOptions.dateTo?.getMilliseconds()).toBe(999);
  });
});
