import {
  BROADCAST_METRICS_CACHE_TTL_SECONDS,
  getBroadcastMetricsCacheKey,
  readDashboardAggregateCache,
  writeDashboardAggregateCache,
} from "@/lib/cache/dashboard-aggregates";
import { BroadcastServiceError, createBroadcastService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBroadcastRouteUserId } from "../../auth";

const broadcastService = createBroadcastService({
  metricsCache: {
    ttlSeconds: BROADCAST_METRICS_CACHE_TTL_SECONDS,
    getKey: getBroadcastMetricsCacheKey,
    read: readDashboardAggregateCache,
    write: writeDashboardAggregateCache,
  },
});

function notFoundResponse() {
  return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveBroadcastRouteUserId(
    request.headers.get("authorization"),
  );
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  try {
    const { id } = await params;
    const result = await broadcastService.getBroadcastMetrics({ userId, id });

    return NextResponse.json(result.payload, {
      headers: { "x-opensend-cache": result.cacheStatus },
    });
  } catch (error) {
    if (error instanceof BroadcastServiceError && error.code === "not_found") {
      return notFoundResponse();
    }

    console.error("Failed to fetch broadcast metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcast metrics" },
      { status: 500 },
    );
  }
}
