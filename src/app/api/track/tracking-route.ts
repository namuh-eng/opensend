import {
  type VerifiedEmailTrackingToken,
  trackingRouteService,
} from "@opensend/core";

export async function findTrackingContext(payload: VerifiedEmailTrackingToken) {
  return await trackingRouteService.findTrackingContext(payload);
}

export function getRequestMetadata(
  request: Request,
): Record<string, string | null> {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  return {
    user_agent: request.headers.get("user-agent"),
    ip,
  };
}
