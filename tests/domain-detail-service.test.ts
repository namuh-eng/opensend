import { describe, expect, it, vi } from "vitest";
import type { domains } from "../packages/core/src/db/schema";
import {
  type DomainDetailServiceDependencies,
  DomainDetailServiceError,
  createDomainDetailService,
} from "../packages/core/src/services/domain-detail";

type DomainRow = typeof domains.$inferSelect;
type DomainUpdateInput = Parameters<
  NonNullable<DomainDetailServiceDependencies["updateDomainForUser"]>
>[0];
type DomainDeleteInput = Parameters<
  NonNullable<DomainDetailServiceDependencies["deleteDomainForUser"]>
>[0];

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "example.com",
    status: "not_started",
    region: "us-east-1",
    dkimTokens: ["dkim-a"],
    records: [
      {
        type: "TXT",
        name: "send.example.com",
        value: "v=spf1 include:amazonses.com ~all",
        status: "pending",
        ttl: "Auto",
      },
    ],
    trackClicks: false,
    trackOpens: false,
    tls: "opportunistic",
    createdAt: new Date("2026-05-06T00:00:00.000Z"),
    document: null,
    userId: "user-1",
    customReturnPath: null,
    trackingSubdomain: null,
    capabilities: [
      { name: "sending", enabled: true },
      { name: "receiving", enabled: false },
    ],
    dkimOrigin: "AWS_SES",
    dkimSelector: null,
    dkimPublicKey: null,
    dkimPrivateKeyCt: null,
    dkimPrivateKeyIv: null,
    ...overrides,
  };
}

describe("domain detail service", () => {
  it("gets a user-scoped domain detail with the public API field shape", async () => {
    const service = createDomainDetailService({
      getDomainById: async () =>
        domainRow({
          customReturnPath: "outbound",
          trackOpens: true,
          trackClicks: true,
          trackingSubdomain: "track.example.com",
          tls: "enforced",
        }),
    });

    const result = await service.getDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(result).toEqual({
      object: "domain",
      id: "11111111-1111-4111-8111-111111111111",
      name: "example.com",
      status: "not_started",
      region: "us-east-1",
      records: [
        {
          type: "TXT",
          name: "send.example.com",
          value: "v=spf1 include:amazonses.com ~all",
          status: "pending",
          ttl: "Auto",
        },
      ],
      custom_return_path: "outbound",
      return_path: "outbound",
      open_tracking: true,
      click_tracking: true,
      tracking_subdomain: "track.example.com",
      tls: "enforced",
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: false },
      ],
      created_at: new Date("2026-05-06T00:00:00.000Z"),
    });
  });

  it("rejects missing or cross-tenant domains before mutation", async () => {
    const updateDomainForUser =
      vi.fn<(_input: DomainUpdateInput) => Promise<DomainRow | undefined>>();
    const service = createDomainDetailService({
      getDomainById: async () => domainRow({ userId: "other-user" }),
      updateDomainForUser,
    });

    await expect(
      service.updateDomainDetail({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        updates: { open_tracking: true },
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      name: "DomainDetailServiceError",
    });
    expect(updateDomainForUser).not.toHaveBeenCalled();
  });

  it("returns the legacy no-op update response without invalidating or queuing an event", async () => {
    const updateDomainForUser =
      vi.fn<(_input: DomainUpdateInput) => Promise<DomainRow | undefined>>();
    const invalidateDomainCaches =
      vi.fn<
        (_input: { id?: string | null; name?: string | null }) => Promise<void>
      >();
    const service = createDomainDetailService({
      getDomainById: async () => domainRow({ trackOpens: true }),
      updateDomainForUser,
      invalidateDomainCaches,
    });

    const result = await service.updateDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      updates: { open_tracking: true },
    });

    expect(result).toEqual({
      response: {
        object: "domain",
        id: "11111111-1111-4111-8111-111111111111",
      },
      changedFields: [],
    });
    expect(updateDomainForUser).not.toHaveBeenCalled();
    expect(invalidateDomainCaches).not.toHaveBeenCalled();
  });

  it("updates changed fields, invalidates caches, and returns the domain.updated payload", async () => {
    const existing = domainRow({
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: false },
      ],
    });
    const updated = domainRow({
      trackOpens: true,
      capabilities: [
        { name: "sending", enabled: false },
        { name: "receiving", enabled: false },
      ],
    });
    const updateCalls: DomainUpdateInput[] = [];
    const invalidateDomainCaches =
      vi.fn<
        (_input: { id?: string | null; name?: string | null }) => Promise<void>
      >();
    const service = createDomainDetailService({
      getDomainById: async () => existing,
      updateDomainForUser: async (input) => {
        updateCalls.push(input);
        return updated;
      },
      invalidateDomainCaches,
    });

    const result = await service.updateDomainDetail({
      id: existing.id,
      userId: "user-1",
      updates: {
        open_tracking: true,
        sending_enabled: false,
      },
    });

    expect(updateCalls).toEqual([
      {
        id: existing.id,
        userId: "user-1",
        updates: {
          trackOpens: true,
          capabilities: [
            { name: "sending", enabled: false },
            { name: "receiving", enabled: false },
          ],
        },
      },
    ]);
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: existing.id,
      name: "example.com",
    });
    expect(result).toEqual({
      response: { object: "domain", id: existing.id },
      changedFields: ["open_tracking", "capabilities"],
      eventPayload: {
        id: existing.id,
        changed_fields: ["open_tracking", "capabilities"],
        domain: {
          id: existing.id,
          name: "example.com",
          status: "not_started",
          region: "us-east-1",
          records: [
            {
              type: "TXT",
              name: "send.example.com",
              value: "v=spf1 include:amazonses.com ~all",
              status: "pending",
              ttl: "Auto",
            },
          ],
          capabilities: [
            { name: "sending", enabled: false },
            { name: "receiving", enabled: false },
          ],
          created_at: "2026-05-06T00:00:00.000Z",
        },
      },
    });
  });

  it("invalidates stale caches when a user-scoped update races with deletion", async () => {
    const invalidateDomainCaches =
      vi.fn<
        (_input: { id?: string | null; name?: string | null }) => Promise<void>
      >();
    const service = createDomainDetailService({
      getDomainById: async () => domainRow(),
      updateDomainForUser: async () => undefined,
      invalidateDomainCaches,
    });

    await expect(
      service.updateDomainDetail({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        updates: { click_tracking: true },
      }),
    ).rejects.toBeInstanceOf(DomainDetailServiceError);
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "example.com",
    });
  });

  it("deletes with best-effort SES and Cloudflare cleanup, cache invalidation, and event payload", async () => {
    const deletedInputs: DomainDeleteInput[] = [];
    const deleteDomainIdentity = vi.fn<(_: string) => Promise<void>>();
    const deleteDNSRecord = vi.fn<(_: string) => Promise<void>>();
    const invalidateDomainCaches =
      vi.fn<
        (_input: { id?: string | null; name?: string | null }) => Promise<void>
      >();
    const service = createDomainDetailService({
      getDomainById: async () => domainRow(),
      deleteDomainIdentity,
      listDNSRecords: async () => [
        {
          id: "spf",
          name: "send.example.com",
          content: "v=spf1 include:amazonses.com ~all",
        },
        {
          id: "dkim",
          name: "abc._domainkey.example.com",
          content: "abc.dkim.amazonses.com",
        },
        { id: "unrelated", name: "www.example.com", content: "1.2.3.4" },
      ],
      deleteDNSRecord,
      deleteDomainForUser: async (input) => {
        deletedInputs.push(input);
        return { id: input.id, name: "example.com" };
      },
      invalidateDomainCaches,
    });

    const result = await service.deleteDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(deleteDomainIdentity).toHaveBeenCalledWith("example.com");
    expect(deleteDNSRecord).toHaveBeenCalledTimes(2);
    expect(deleteDNSRecord).toHaveBeenCalledWith("spf");
    expect(deleteDNSRecord).toHaveBeenCalledWith("dkim");
    expect(deletedInputs).toEqual([
      { id: "11111111-1111-4111-8111-111111111111", userId: "user-1" },
    ]);
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "example.com",
    });
    expect(result).toEqual({
      response: {
        object: "domain",
        id: "11111111-1111-4111-8111-111111111111",
        deleted: true,
      },
      eventPayload: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "example.com",
      },
    });
  });

  it("continues deletion when SES and Cloudflare cleanup fail", async () => {
    const warn = vi.fn<Console["warn"]>();
    const service = createDomainDetailService({
      getDomainById: async () => domainRow(),
      deleteDomainIdentity: async () => {
        throw new Error("ses unavailable");
      },
      listDNSRecords: async () => {
        throw new Error("cloudflare unavailable");
      },
      deleteDomainForUser: async (input) => ({
        id: input.id,
        name: "example.com",
      }),
      logger: { warn },
    });

    const result = await service.deleteDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(result.response.deleted).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "Failed to delete SES identity for example.com:",
      expect.any(Error),
    );
    expect(warn).toHaveBeenCalledWith(
      "Failed to cleanup Cloudflare records for example.com:",
      expect.any(Error),
    );
  });
});
