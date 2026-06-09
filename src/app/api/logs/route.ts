import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { publicApiError } from "@/lib/api-errors";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { parseTagQueryParams } from "@/lib/tag-query-params";
import { createLogReadService } from "@opensend/core";

const logReadService = createLogReadService();

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const parsedTags = parseTagQueryParams(url.searchParams);
  if (!parsedTags.ok) {
    return Response.json(
      publicApiError(
        "validation_error",
        "Validation failed.",
        422,
        parsedTags.details,
      ),
      { status: 422 },
    );
  }

  try {
    const result = await logReadService.listLogs({
      userId: auth.userId,
      limit: Number(url.searchParams.get("limit")) || 20,
      status: url.searchParams.get("status"),
      method: url.searchParams.get("method"),
      apiKeyId:
        url.searchParams.get("api_key_id") || url.searchParams.get("apiKeyId"),
      after: url.searchParams.get("after"),
      before: url.searchParams.get("before"),
      dateFrom:
        url.searchParams.get("date_from") ||
        url.searchParams.get("created_after"),
      dateTo:
        url.searchParams.get("date_to") ||
        url.searchParams.get("created_before"),
      userAgent:
        url.searchParams.get("user_agent") || url.searchParams.get("userAgent"),
      search: url.searchParams.get("q") || url.searchParams.get("search"),
      tagName: parsedTags.value.tagName,
      tagValue: parsedTags.value.tagValue,
    });

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list logs";
    return Response.json({ error: message }, { status: 500 });
  }
}
