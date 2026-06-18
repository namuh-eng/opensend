import { describe, expect, it, vi } from "vitest";
import type { ReceivingRouteWithDomain } from "../packages/core/src/db/repositories/receivingRouteRepo";
import type { domains } from "../packages/core/src/db/schema";
import {
  type ReceivingRouteRepository,
  type ReceivingRouteServiceError,
  createReceivingRouteService,
} from "../packages/core/src/services/receivingRoutes";

type DomainRow = typeof domains.$inferSelect;

function domainRow(overrides: Partial<DomainRow> = {}): DomainRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "inbound.example.com",
    status: "verified",
    region: "us-east-1",
    dkimTokens: [],
    records: [],
    trackClicks: false,
    trackOpens: false,
    tls: "opportunistic",
    createdAt: new Date("2026-05-28T00:00:00.000Z"),
    document: null,
    userId: "user-1",
    customReturnPath: null,
    trackingSubdomain: null,
    capabilities: [
      { name: "sending", enabled: true },
      { name: "receiving", enabled: true },
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

function routeRow(
  overrides: Partial<ReceivingRouteWithDomain> = {},
): ReceivingRouteWithDomain {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user-1",
    domainId: "11111111-1111-4111-8111-111111111111",
    type: "exact",
    localPart: "support",
    targetLocalPart: "support",
    createdAt: new Date("2026-05-28T00:00:00.000Z"),
    updatedAt: new Date("2026-05-28T00:00:00.000Z"),
    domainName: "inbound.example.com",
    domainStatus: "verified",
    domainCapabilities: [
      { name: "sending", enabled: true },
      { name: "receiving", enabled: true },
    ],
    ...overrides,
  };
}

function repositoryWithRoutes(
  routes: ReceivingRouteWithDomain[],
): ReceivingRouteRepository {
  return {
    listForUser: vi.fn(async ({ userId, domainId }) =>
      routes.filter(
        (route) =>
          route.userId === userId && (!domainId || route.domainId === domainId),
      ),
    ),
    listForDomain: vi.fn(async (domainId) =>
      routes.filter((route) => route.domainId === domainId),
    ),
    findByIdForUser: vi.fn(async (id, userId) =>
      routes.find((route) => route.id === id && route.userId === userId),
    ),
    create: vi.fn(async (data) =>
      routeRow({
        ...data,
        id: "33333333-3333-4333-8333-333333333333",
        localPart: data.localPart ?? null,
      }),
    ),
    update: vi.fn(async (id, userId, data) => {
      const existing = routes.find(
        (route) => route.id === id && route.userId === userId,
      );
      return existing ? { ...existing, ...data } : undefined;
    }),
    delete: vi.fn(async (id, userId) => {
      const existing = routes.find(
        (route) => route.id === id && route.userId === userId,
      );
      return existing ? { id } : undefined;
    }),
  };
}

describe("receiving route service", () => {
  it("matches exact before alias, alias before catch-all, and then unrouteable", async () => {
    const domain = domainRow();
    const service = createReceivingRouteService({
      domainRepository: {
        findByIdForUser: async () => domain,
        findByName: async (name) => (name === domain.name ? domain : undefined),
        findByNameForUser: async (name) =>
          name === domain.name ? domain : undefined,
      },
      routeRepository: repositoryWithRoutes([
        routeRow({
          id: "exact-route",
          type: "exact",
          localPart: "support",
          targetLocalPart: "primary",
        }),
        routeRow({
          id: "alias-route",
          type: "alias",
          localPart: "support",
          targetLocalPart: "alias-target",
        }),
        routeRow({
          id: "alias-billing",
          type: "alias",
          localPart: "billing",
          targetLocalPart: "accounts",
        }),
        routeRow({
          id: "catch-all-route",
          type: "catch_all",
          localPart: null,
          targetLocalPart: "inbox",
        }),
      ]),
    });

    await expect(
      service.matchRecipient({
        recipient: "Support@Inbound.Example.com",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      status: "exact",
      routeId: "exact-route",
      targetAddress: "primary@inbound.example.com",
    });

    await expect(
      service.matchRecipient({
        recipient: "billing@inbound.example.com",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      status: "alias",
      routeId: "alias-billing",
      targetAddress: "accounts@inbound.example.com",
    });

    await expect(
      service.matchRecipient({
        recipient: "new@inbound.example.com",
        userId: "user-1",
      }),
    ).resolves.toMatchObject({
      status: "catch_all",
      routeId: "catch-all-route",
      targetAddress: "inbox@inbound.example.com",
    });

    await expect(
      service.matchRecipient({ recipient: "missing@other.example.com" }),
    ).resolves.toEqual({
      recipient: "missing@other.example.com",
      status: "unrouteable",
    });
  });

  it("requires verified receiving domain ownership before creating routes", async () => {
    const create = vi.fn<ReceivingRouteRepository["create"]>();
    const service = createReceivingRouteService({
      domainRepository: {
        findByIdForUser: async () =>
          domainRow({ capabilities: [{ name: "receiving", enabled: false }] }),
        findByName: async () => undefined,
        findByNameForUser: async () => undefined,
      },
      routeRepository: { ...repositoryWithRoutes([]), create },
    });

    await expect(
      service.createRoute({
        userId: "user-1",
        domainId: "11111111-1111-4111-8111-111111111111",
        type: "exact",
        localPart: "support",
      }),
    ).rejects.toMatchObject({
      code: "domain_not_ready",
      name: "ReceivingRouteServiceError",
    } satisfies Partial<ReceivingRouteServiceError>);
    expect(create).not.toHaveBeenCalled();
  });

  it("allows one catch-all route per domain", async () => {
    const service = createReceivingRouteService({
      domainRepository: {
        findByIdForUser: async () => domainRow(),
        findByName: async () => domainRow(),
        findByNameForUser: async () => domainRow(),
      },
      routeRepository: repositoryWithRoutes([
        routeRow({
          type: "catch_all",
          localPart: null,
          targetLocalPart: "inbox",
        }),
      ]),
    });

    await expect(
      service.createRoute({
        userId: "user-1",
        domainId: "11111111-1111-4111-8111-111111111111",
        type: "catch_all",
        targetLocalPart: "fallback",
      }),
    ).rejects.toMatchObject({ code: "route_conflict" });
  });
});
