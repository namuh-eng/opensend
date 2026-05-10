import { listRunsQuerySchema } from "@/lib/validation/automations";
import {
  authorizeAutomationRunRoute,
  automationRunService,
  mapAutomationRunServiceError,
} from "./route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const parsed = listRunsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    after: url.searchParams.get("after") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    const result = await automationRunService.listRuns({
      automationId: id,
      userId: auth.userId,
      ...parsed.data,
    });

    return Response.json(result);
  } catch (err) {
    return mapAutomationRunServiceError(err, "Failed to list automation runs");
  }
}
