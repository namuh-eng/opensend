import { automationRunMetricsQuerySchema } from "@/lib/validation/automations";
import {
  authorizeAutomationRunRoute,
  automationRunService,
  mapAutomationRunServiceError,
} from "../route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const parsed = automationRunMetricsQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
    const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
    const metrics = await automationRunService.getMetrics({
      automationId: id,
      userId: auth.userId,
      from,
      to,
    });

    return Response.json(metrics);
  } catch (err) {
    return mapAutomationRunServiceError(
      err,
      "Failed to retrieve automation run metrics",
    );
  }
}
