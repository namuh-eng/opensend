import { domainRepo } from "../db/repositories/domainRepo";
import {
  type ReceivingRouteWithDomain,
  receivingRouteRepo,
} from "../db/repositories/receivingRouteRepo";
import type { domains, receivingRoutes } from "../db/schema";

type DomainRow = typeof domains.$inferSelect;
type ReceivingRouteRow = typeof receivingRoutes.$inferSelect;
type ReceivingRouteInsert = typeof receivingRoutes.$inferInsert;

export type ReceivingRouteType = "exact" | "alias" | "catch_all";
export type ReceivingRouteDecisionStatus =
  | "exact"
  | "alias"
  | "catch_all"
  | "unrouteable";

export type ReceivingRouteDecision = {
  recipient: string;
  status: ReceivingRouteDecisionStatus;
  domainId?: string;
  routeId?: string;
  routeType?: ReceivingRouteType;
  localPart?: string;
  targetAddress?: string;
};

export type ReceivingRouteResponse = {
  object: "receiving_route";
  id: string;
  domain_id: string;
  domain: string;
  type: ReceivingRouteType;
  local_part: string | null;
  target_local_part: string;
  target_address: string;
  created_at: Date;
  updated_at: Date;
};

export type ReceivingRouteListResponse = {
  object: "list";
  data: ReceivingRouteResponse[];
};

export type CreateReceivingRouteInput = {
  userId: string;
  domainId: string;
  type: ReceivingRouteType;
  localPart?: string | null;
  targetLocalPart?: string | null;
};

export type UpdateReceivingRouteInput = {
  userId: string;
  id: string;
  localPart?: string | null;
  targetLocalPart?: string | null;
};

export type MatchReceivingRouteInput = {
  recipient: string;
  userId?: string | null;
};

export type ReceivingRouteRepository = {
  listForUser(options: {
    userId: string;
    domainId?: string;
  }): Promise<ReceivingRouteWithDomain[]>;
  listForDomain(domainId: string): Promise<ReceivingRouteWithDomain[]>;
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<ReceivingRouteWithDomain | undefined>;
  create(data: ReceivingRouteInsert): Promise<ReceivingRouteRow>;
  update(
    id: string,
    userId: string,
    data: Partial<ReceivingRouteInsert>,
  ): Promise<ReceivingRouteRow | undefined>;
  delete(id: string, userId: string): Promise<{ id: string } | undefined>;
};

export type ReceivingRouteDomainRepository = {
  findByIdForUser(id: string, userId: string): Promise<DomainRow | undefined>;
  findByName(name: string): Promise<DomainRow | undefined>;
  findByNameForUser(
    name: string,
    userId: string,
  ): Promise<DomainRow | undefined>;
};

export type ReceivingRouteServiceDependencies = {
  routeRepository?: ReceivingRouteRepository;
  domainRepository?: ReceivingRouteDomainRepository;
};

export type ReceivingRouteServiceErrorCode =
  | "domain_not_found"
  | "domain_not_ready"
  | "route_not_found"
  | "invalid_route"
  | "route_conflict";

export class ReceivingRouteServiceError extends Error {
  constructor(
    readonly code: ReceivingRouteServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReceivingRouteServiceError";
  }
}

function hasReceivingEnabled(domain: Pick<DomainRow, "capabilities">): boolean {
  return Boolean(
    domain.capabilities?.some(
      (capability) => capability.name === "receiving" && capability.enabled,
    ),
  );
}

function isVerifiedReceivingDomain(
  domain: DomainRow | undefined,
): domain is DomainRow {
  return Boolean(
    domain && domain.status === "verified" && hasReceivingEnabled(domain),
  );
}

function normalizeLocalPart(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.length > 320 ||
    normalized.includes("@") ||
    /[\s,<>]/.test(normalized)
  ) {
    throw new ReceivingRouteServiceError(
      "invalid_route",
      "Local parts must be address local parts without @, spaces, commas, or angle brackets",
    );
  }

  return normalized;
}

function normalizeRouteType(type: string): ReceivingRouteType {
  if (type === "exact" || type === "alias" || type === "catch_all") return type;
  throw new ReceivingRouteServiceError(
    "invalid_route",
    "Route type must be exact, alias, or catch_all",
  );
}

function parseRecipient(
  recipient: string,
): { normalized: string; localPart: string; domain: string } | null {
  const normalized = recipient.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;

  return {
    normalized,
    localPart: normalized.slice(0, at),
    domain: normalized.slice(at + 1),
  };
}

function targetAddress(domain: string, localPart: string): string {
  return `${localPart}@${domain}`;
}

function toResponse(route: ReceivingRouteWithDomain): ReceivingRouteResponse {
  const type = normalizeRouteType(route.type);
  return {
    object: "receiving_route",
    id: route.id,
    domain_id: route.domainId,
    domain: route.domainName,
    type,
    local_part: route.localPart,
    target_local_part: route.targetLocalPart,
    target_address: targetAddress(route.domainName, route.targetLocalPart),
    created_at: route.createdAt,
    updated_at: route.updatedAt,
  };
}

function validateRouteShape(input: {
  type: ReceivingRouteType;
  localPart?: string | null;
  targetLocalPart?: string | null;
}): { localPart: string | null; targetLocalPart: string } {
  const localPart = normalizeLocalPart(input.localPart);
  const normalizedTarget = normalizeLocalPart(input.targetLocalPart);

  if (input.type === "catch_all") {
    if (localPart) {
      throw new ReceivingRouteServiceError(
        "invalid_route",
        "Catch-all routes cannot include a local part",
      );
    }
    if (!normalizedTarget) {
      throw new ReceivingRouteServiceError(
        "invalid_route",
        "Catch-all routes require a target local part",
      );
    }
    return { localPart: null, targetLocalPart: normalizedTarget };
  }

  if (!localPart) {
    throw new ReceivingRouteServiceError(
      "invalid_route",
      "Exact and alias routes require a local part",
    );
  }

  if (input.type === "exact") {
    return { localPart, targetLocalPart: normalizedTarget ?? localPart };
  }

  if (!normalizedTarget) {
    throw new ReceivingRouteServiceError(
      "invalid_route",
      "Alias routes require a target local part",
    );
  }

  return { localPart, targetLocalPart: normalizedTarget };
}

function buildDecision(
  recipient: string,
  domain: DomainRow | undefined,
  route: ReceivingRouteWithDomain | undefined,
  status: ReceivingRouteDecisionStatus,
): ReceivingRouteDecision {
  if (!domain || !route) return { recipient, status: "unrouteable" };

  return {
    recipient,
    status,
    domainId: domain.id,
    routeId: route.id,
    routeType: normalizeRouteType(route.type),
    localPart: route.localPart ?? undefined,
    targetAddress: targetAddress(domain.name, route.targetLocalPart),
  };
}

export function createReceivingRouteService({
  routeRepository = receivingRouteRepo,
  domainRepository = domainRepo,
}: ReceivingRouteServiceDependencies = {}) {
  async function requireOwnedDomainForRead(userId: string, domainId: string) {
    const domain = await domainRepository.findByIdForUser(domainId, userId);
    if (!domain) {
      throw new ReceivingRouteServiceError(
        "domain_not_found",
        "Domain not found",
      );
    }
    return domain;
  }

  async function requireVerifiedReceivingDomain(
    userId: string,
    domainId: string,
  ) {
    const domain = await requireOwnedDomainForRead(userId, domainId);
    if (!isVerifiedReceivingDomain(domain)) {
      throw new ReceivingRouteServiceError(
        "domain_not_ready",
        "Receiving routes require a verified domain with receiving enabled",
      );
    }
    return domain;
  }

  async function assertNoConflict(input: {
    domainId: string;
    type: ReceivingRouteType;
    localPart: string | null;
    ignoreId?: string;
  }) {
    const existing = await routeRepository.listForDomain(input.domainId);
    const conflict = existing.find((route) => {
      if (input.ignoreId && route.id === input.ignoreId) return false;
      const type = normalizeRouteType(route.type);
      if (input.type === "catch_all" || type === "catch_all") {
        return input.type === "catch_all" && type === "catch_all";
      }
      return type === input.type && route.localPart === input.localPart;
    });

    if (conflict) {
      throw new ReceivingRouteServiceError(
        "route_conflict",
        "A receiving route with this type and local part already exists for the domain",
      );
    }
  }

  return {
    async listRoutes(input: {
      userId: string;
      domainId?: string | null;
    }): Promise<ReceivingRouteListResponse> {
      if (input.domainId) {
        await requireOwnedDomainForRead(input.userId, input.domainId);
      }
      const routes = await routeRepository.listForUser({
        userId: input.userId,
        domainId: input.domainId ?? undefined,
      });
      return { object: "list", data: routes.map(toResponse) };
    },

    async getRoute(
      id: string,
      userId: string,
    ): Promise<ReceivingRouteResponse> {
      const route = await routeRepository.findByIdForUser(id, userId);
      if (!route) {
        throw new ReceivingRouteServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }
      await requireOwnedDomainForRead(userId, route.domainId);
      return toResponse(route);
    },

    async createRoute(
      input: CreateReceivingRouteInput,
    ): Promise<ReceivingRouteResponse> {
      const type = normalizeRouteType(input.type);
      const domain = await requireVerifiedReceivingDomain(
        input.userId,
        input.domainId,
      );
      const normalized = validateRouteShape({
        type,
        localPart: input.localPart,
        targetLocalPart: input.targetLocalPart,
      });
      await assertNoConflict({
        domainId: domain.id,
        type,
        localPart: normalized.localPart,
      });

      const created = await routeRepository.create({
        userId: input.userId,
        domainId: domain.id,
        type,
        localPart: normalized.localPart,
        targetLocalPart: normalized.targetLocalPart,
      });

      return toResponse({
        ...created,
        domainName: domain.name,
        domainStatus: domain.status,
        domainCapabilities: domain.capabilities,
      });
    },

    async updateRoute(
      input: UpdateReceivingRouteInput,
    ): Promise<ReceivingRouteResponse> {
      const existing = await routeRepository.findByIdForUser(
        input.id,
        input.userId,
      );
      if (!existing) {
        throw new ReceivingRouteServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }
      await requireVerifiedReceivingDomain(input.userId, existing.domainId);

      const type = normalizeRouteType(existing.type);
      const normalized = validateRouteShape({
        type,
        localPart:
          input.localPart === undefined ? existing.localPart : input.localPart,
        targetLocalPart:
          input.targetLocalPart === undefined
            ? existing.targetLocalPart
            : input.targetLocalPart,
      });
      await assertNoConflict({
        domainId: existing.domainId,
        type,
        localPart: normalized.localPart,
        ignoreId: existing.id,
      });

      const updated = await routeRepository.update(existing.id, input.userId, {
        localPart: normalized.localPart,
        targetLocalPart: normalized.targetLocalPart,
      });
      if (!updated) {
        throw new ReceivingRouteServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }

      return toResponse({
        ...updated,
        domainName: existing.domainName,
        domainStatus: existing.domainStatus,
        domainCapabilities: existing.domainCapabilities,
      });
    },

    async deleteRoute(
      id: string,
      userId: string,
    ): Promise<{ object: "receiving_route"; id: string; deleted: true }> {
      const existing = await routeRepository.findByIdForUser(id, userId);
      if (!existing) {
        throw new ReceivingRouteServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }
      await requireOwnedDomainForRead(userId, existing.domainId);
      const deleted = await routeRepository.delete(id, userId);
      if (!deleted) {
        throw new ReceivingRouteServiceError(
          "route_not_found",
          "Receiving route not found",
        );
      }
      return { object: "receiving_route", id: deleted.id, deleted: true };
    },

    async matchRecipient(
      input: MatchReceivingRouteInput,
    ): Promise<ReceivingRouteDecision & { userId?: string }> {
      const parsed = parseRecipient(input.recipient);
      if (!parsed) return { recipient: input.recipient, status: "unrouteable" };

      const domain = input.userId
        ? await domainRepository.findByNameForUser(parsed.domain, input.userId)
        : await domainRepository.findByName(parsed.domain);

      if (!isVerifiedReceivingDomain(domain)) {
        return { recipient: parsed.normalized, status: "unrouteable" };
      }

      const routes = await routeRepository.listForDomain(domain.id);
      const exact = routes.find(
        (route) =>
          route.type === "exact" && route.localPart === parsed.localPart,
      );
      if (exact) {
        return {
          ...buildDecision(parsed.normalized, domain, exact, "exact"),
          userId: domain.userId ?? undefined,
        };
      }

      const alias = routes.find(
        (route) =>
          route.type === "alias" && route.localPart === parsed.localPart,
      );
      if (alias) {
        return {
          ...buildDecision(parsed.normalized, domain, alias, "alias"),
          userId: domain.userId ?? undefined,
        };
      }

      const catchAll = routes.find((route) => route.type === "catch_all");
      if (catchAll) {
        return {
          ...buildDecision(parsed.normalized, domain, catchAll, "catch_all"),
          userId: domain.userId ?? undefined,
        };
      }

      return {
        recipient: parsed.normalized,
        status: "unrouteable",
        domainId: domain.id,
        userId: domain.userId ?? undefined,
      };
    },

    async matchRecipients(
      recipients: string[],
      userId?: string | null,
    ): Promise<Array<ReceivingRouteDecision & { userId?: string }>> {
      const decisions: Array<ReceivingRouteDecision & { userId?: string }> = [];
      for (const recipient of recipients) {
        decisions.push(await this.matchRecipient({ recipient, userId }));
      }
      return decisions;
    },
  };
}
