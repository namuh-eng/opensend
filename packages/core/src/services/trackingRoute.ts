import { domainRepo } from "../db/repositories/domainRepo";
import { emailRepo } from "../db/repositories/emailRepo";
import type { domains, emails } from "../db/schema";
import type { VerifiedEmailTrackingToken } from "./tracking";

type EmailRow = typeof emails.$inferSelect;
type DomainRow = typeof domains.$inferSelect;

export type TrackingRouteContext = {
  email: EmailRow;
  domain: DomainRow;
};

export type TrackingRouteLookupRepository = {
  findEmailByIdForUser(
    id: string,
    userId: string,
  ): Promise<EmailRow | undefined>;
  findDomainByIdForUser(
    id: string,
    userId: string,
  ): Promise<DomainRow | undefined>;
};

const defaultTrackingRouteLookupRepository: TrackingRouteLookupRepository = {
  async findEmailByIdForUser(id, userId) {
    return await emailRepo.findByIdForUser(id, userId);
  },
  async findDomainByIdForUser(id, userId) {
    return await domainRepo.findByIdForUser(id, userId);
  },
};

export type TrackingRouteServiceDependencies = {
  repository?: TrackingRouteLookupRepository;
};

export function createTrackingRouteService({
  repository = defaultTrackingRouteLookupRepository,
}: TrackingRouteServiceDependencies = {}) {
  return {
    async findTrackingContext(
      payload: VerifiedEmailTrackingToken,
    ): Promise<TrackingRouteContext | null> {
      const [email, domain] = await Promise.all([
        repository.findEmailByIdForUser(payload.emailId, payload.userId),
        repository.findDomainByIdForUser(payload.domainId, payload.userId),
      ]);

      if (!email || !domain) return null;
      if (payload.kind === "click" && !domain.trackClicks) return null;
      if (payload.kind === "open" && !domain.trackOpens) return null;

      return { email, domain };
    },
  };
}

export const trackingRouteService = createTrackingRouteService();
