import { describe, expect, it, vi } from "vitest";
import type { domains } from "../packages/core/src/db/schema";
import { configurationSetService } from "../packages/core/src/services/configurationSet";
import {
  type DomainDetailServiceDependencies,
  DomainDetailServiceError,
  createDomainDetailService,
} from "../packages/core/src/services/domain-detail";
import {
  cloudflareDnsCleanupProvider,
  domainIdentityProvider,
} from "../packages/core/src/services/domain-providers";

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
    dedicatedIpPoolId: null,
    sesConfigurationSetName: null,
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
          trackingSubdomain: "links",
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
      tracking_subdomain: "links",
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
        (_input: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
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
        (_input: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
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
      region: "us-east-1",
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

  it("provisions hosted receiving before enabling the receiving capability", async () => {
    const existing = domainRow({
      status: "verified",
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: false },
      ],
    });
    const updateCalls: DomainUpdateInput[] = [];
    const operationOrder: string[] = [];
    const provisionReceivingDomain = vi.fn<
      (_input: { domainName: string; region?: string | null }) => Promise<void>
    >(async () => {
      operationOrder.push("provision");
    });
    const service = createDomainDetailService({
      getDomainById: async () => existing,
      provisionReceivingDomain,
      updateDomainForUser: async (input) => {
        operationOrder.push("update");
        updateCalls.push(input);
        return domainRow({ ...existing, ...input.updates });
      },
    });

    const result = await service.updateDomainDetail({
      id: existing.id,
      userId: "user-1",
      updates: { receiving_enabled: true },
    });

    expect(result.changedFields).toEqual(["capabilities"]);
    expect(operationOrder).toEqual(["provision", "update"]);
    expect(provisionReceivingDomain).toHaveBeenCalledWith({
      domainName: "example.com",
      region: "us-east-1",
    });
    expect(updateCalls).toEqual([
      {
        id: existing.id,
        userId: "user-1",
        updates: {
          capabilities: [
            { name: "sending", enabled: true },
            { name: "receiving", enabled: true },
          ],
        },
      },
    ]);
  });

  it("does not persist receiving_enabled when hosted receiving provisioning fails", async () => {
    const existing = domainRow({
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: false },
      ],
    });
    const updateDomainForUser =
      vi.fn<(_input: DomainUpdateInput) => Promise<DomainRow | undefined>>();
    const service = createDomainDetailService({
      getDomainById: async () => existing,
      provisionReceivingDomain: async () => {
        throw new Error("missing receiving infra");
      },
      updateDomainForUser,
    });

    await expect(
      service.updateDomainDetail({
        id: existing.id,
        userId: "user-1",
        updates: { receiving_enabled: true },
      }),
    ).rejects.toMatchObject({
      code: "receiving_provisioning_failed",
      message: "Failed to provision receiving for this domain",
    });
    expect(updateDomainForUser).not.toHaveBeenCalled();
  });

  it("deprovisions hosted receiving before disabling the receiving capability", async () => {
    const existing = domainRow({
      status: "verified",
      capabilities: [
        { name: "sending", enabled: true },
        { name: "receiving", enabled: true },
      ],
    });
    const operationOrder: string[] = [];
    const deprovisionReceivingDomain = vi.fn<
      (_input: { domainName: string; region?: string | null }) => Promise<void>
    >(async () => {
      operationOrder.push("deprovision");
    });
    const service = createDomainDetailService({
      getDomainById: async () => existing,
      deprovisionReceivingDomain,
      updateDomainForUser: async (input) => {
        operationOrder.push("update");
        return domainRow({ ...existing, ...input.updates });
      },
    });

    await service.updateDomainDetail({
      id: existing.id,
      userId: "user-1",
      updates: { receiving_enabled: false },
    });

    expect(operationOrder).toEqual(["deprovision", "update"]);
    expect(deprovisionReceivingDomain).toHaveBeenCalledWith({
      domainName: "example.com",
      region: "us-east-1",
    });
  });

  it("updates tracking subdomain and reconciles the pending CNAME record", async () => {
    const previousTrackingTarget = process.env.TRACKING_CNAME_TARGET;
    process.env.TRACKING_CNAME_TARGET = "track.opensend.example";
    const existing = domainRow({
      trackingSubdomain: null,
      records: [
        {
          type: "TXT",
          name: "send.example.com",
          value: "v=spf1 include:amazonses.com ~all",
          status: "pending",
          ttl: "Auto",
        },
      ],
    });
    const updateCalls: DomainUpdateInput[] = [];
    const service = createDomainDetailService({
      getDomainById: async () => existing,
      updateDomainForUser: async (input) => {
        updateCalls.push(input);
        return domainRow({ ...existing, ...input.updates });
      },
    });

    try {
      const result = await service.updateDomainDetail({
        id: existing.id,
        userId: "user-1",
        updates: { tracking_subdomain: "links" },
      });

      expect(result.changedFields).toEqual(["tracking_subdomain"]);
      expect(updateCalls).toEqual([
        {
          id: existing.id,
          userId: "user-1",
          updates: {
            trackingSubdomain: "links",
            records: [
              {
                type: "TXT",
                name: "send.example.com",
                value: "v=spf1 include:amazonses.com ~all",
                status: "pending",
                ttl: "Auto",
              },
              {
                type: "CNAME",
                name: "links.example.com",
                value: "track.opensend.example",
                status: "pending",
                ttl: "Auto",
              },
            ],
          },
        },
      ]);
    } finally {
      if (previousTrackingTarget === undefined) {
        process.env.TRACKING_CNAME_TARGET = undefined;
      } else {
        process.env.TRACKING_CNAME_TARGET = previousTrackingTarget;
      }
    }
  });

  it("writes back the config-set name returned by a successful SES resync", async () => {
    const previousTopicArn = process.env.SES_EVENTS_SNS_TOPIC_ARN;
    process.env.SES_EVENTS_SNS_TOPIC_ARN =
      "arn:aws:sns:us-east-1:123456789012:opensend-ses-events";
    const syncDomainConfigurationSet = vi
      .spyOn(configurationSetService, "syncDomainConfigurationSet")
      .mockResolvedValueOnce("opensend-domain-11111111");
    const updateCalls: DomainUpdateInput[] = [];
    let current = domainRow({ sesConfigurationSetName: null });
    const service = createDomainDetailService({
      getDomainById: async () => current,
      updateDomainForUser: async (input) => {
        updateCalls.push(input);
        current = domainRow({ ...current, ...input.updates });
        return current;
      },
    });

    try {
      const result = await service.updateDomainDetail({
        id: current.id,
        userId: "user-1",
        updates: { tls: "required" },
      });

      expect(result.changedFields).toEqual(["tls"]);
      expect(syncDomainConfigurationSet).toHaveBeenCalledWith({
        domainId: current.id,
        tls: "required",
        dedicatedIpPoolSesName: null,
        existingConfigSetName: null,
        eventDestinationTopicArn:
          "arn:aws:sns:us-east-1:123456789012:opensend-ses-events",
        region: "us-east-1",
      });
      expect(updateCalls).toEqual([
        {
          id: current.id,
          userId: "user-1",
          updates: { tls: "required" },
        },
        {
          id: current.id,
          userId: "user-1",
          updates: { sesConfigurationSetName: "opensend-domain-11111111" },
        },
      ]);
    } finally {
      syncDomainConfigurationSet.mockRestore();
      if (previousTopicArn === undefined) {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = "";
      } else {
        process.env.SES_EVENTS_SNS_TOPIC_ARN = previousTopicArn;
      }
    }
  });

  it("invalidates stale caches when a user-scoped update races with deletion", async () => {
    const invalidateDomainCaches =
      vi.fn<
        (_input: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
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
      region: "us-east-1",
    });
  });

  it("uses core provider defaults for best-effort SES and Cloudflare cleanup", async () => {
    const deleteDomainIdentity = vi
      .spyOn(domainIdentityProvider, "deleteDomainIdentity")
      .mockResolvedValueOnce();
    const listDNSRecords = vi
      .spyOn(cloudflareDnsCleanupProvider, "listDNSRecords")
      .mockResolvedValueOnce([
        {
          id: "spf",
          name: "send.example.com",
          content: "v=spf1 include:amazonses.com ~all",
        },
        {
          id: "unrelated",
          name: "www.example.com",
          content: "1.2.3.4",
        },
      ]);
    const deleteDNSRecord = vi
      .spyOn(cloudflareDnsCleanupProvider, "deleteDNSRecord")
      .mockResolvedValueOnce();

    try {
      const service = createDomainDetailService({
        getDomainById: async () => domainRow(),
        deleteDomainForUser: async (input) => ({
          id: input.id,
          name: "example.com",
        }),
      });

      const result = await service.deleteDomainDetail({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
      });

      expect(result.response.deleted).toBe(true);
      expect(deleteDomainIdentity).toHaveBeenCalledWith("example.com", {
        region: "us-east-1",
      });
      expect(listDNSRecords).toHaveBeenCalledWith({ name: "example.com" });
      expect(deleteDNSRecord).toHaveBeenCalledWith("spf");
      expect(deleteDNSRecord).toHaveBeenCalledTimes(1);
    } finally {
      deleteDomainIdentity.mockRestore();
      listDNSRecords.mockRestore();
      deleteDNSRecord.mockRestore();
    }
  });

  it("deprovisions hosted receiving before deleting a receiving-enabled domain", async () => {
    const operationOrder: string[] = [];
    const deprovisionReceivingDomain = vi.fn<
      (_input: { domainName: string; region?: string | null }) => Promise<void>
    >(async () => {
      operationOrder.push("deprovision");
    });
    const service = createDomainDetailService({
      getDomainById: async () =>
        domainRow({
          capabilities: [
            { name: "sending", enabled: true },
            { name: "receiving", enabled: true },
          ],
        }),
      deprovisionReceivingDomain,
      deleteDomainIdentity: async () => {
        operationOrder.push("delete-ses-identity");
      },
      listDNSRecords: async () => [],
      deleteDomainForUser: async (input) => {
        operationOrder.push("delete-db-row");
        return { id: input.id, name: "example.com" };
      },
    });

    await service.deleteDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(operationOrder).toEqual([
      "deprovision",
      "delete-ses-identity",
      "delete-db-row",
    ]);
    expect(deprovisionReceivingDomain).toHaveBeenCalledWith({
      domainName: "example.com",
      region: "us-east-1",
    });
  });

  it("continues deleting a receiving-enabled domain when hosted receiving deprovision fails", async () => {
    const warn = vi.fn<Console["warn"]>();
    const deleteDomainForUser = vi.fn<
      (_input: DomainDeleteInput) => Promise<{ id: string; name: string }>
    >(async (input) => ({ id: input.id, name: "example.com" }));
    const service = createDomainDetailService({
      getDomainById: async () =>
        domainRow({
          capabilities: [
            { name: "sending", enabled: true },
            { name: "receiving", enabled: true },
          ],
        }),
      deprovisionReceivingDomain: async () => {
        throw new Error("receipt rule unavailable");
      },
      deleteDomainIdentity: async () => {},
      listDNSRecords: async () => [],
      deleteDomainForUser,
      logger: { warn },
    });

    const result = await service.deleteDomainDetail({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(result.response.deleted).toBe(true);
    expect(deleteDomainForUser).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });
    expect(warn).toHaveBeenCalledWith(
      "Failed to deprovision hosted receiving for example.com:",
      expect.any(Error),
    );
  });

  it("deletes with best-effort SES and Cloudflare cleanup, cache invalidation, and event payload", async () => {
    const deletedInputs: DomainDeleteInput[] = [];
    const deleteDomainIdentity = vi.fn<(_: string) => Promise<void>>();
    const deleteDNSRecord = vi.fn<(_: string) => Promise<void>>();
    const invalidateDomainCaches =
      vi.fn<
        (_input: {
          id?: string | null;
          name?: string | null;
          region?: string | null;
        }) => Promise<void>
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

    expect(deleteDomainIdentity).toHaveBeenCalledWith("example.com", {
      region: "us-east-1",
    });
    expect(deleteDNSRecord).toHaveBeenCalledTimes(2);
    expect(deleteDNSRecord).toHaveBeenCalledWith("spf");
    expect(deleteDNSRecord).toHaveBeenCalledWith("dkim");
    expect(deletedInputs).toEqual([
      { id: "11111111-1111-4111-8111-111111111111", userId: "user-1" },
    ]);
    expect(invalidateDomainCaches).toHaveBeenCalledWith({
      id: "11111111-1111-4111-8111-111111111111",
      name: "example.com",
      region: "us-east-1",
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
