import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { ApiKeyServiceError } from "@opensend/core";

type ApiKeyRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function resolveUserId(auth: ApiKeyRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function authorizeApiKeyRoute(
  request: Request,
): Promise<{ userId: string } | { response: Response }> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { response: permissionError };

  const userId = await resolveUserId(auth);
  if (!userId) return { response: unauthorizedResponse() };

  return { userId };
}

export function mapApiKeyServiceError(
  err: unknown,
  fallback: string,
): Response {
  if (err instanceof ApiKeyServiceError) {
    const status = err.code === "not_found" ? 404 : 422;
    return Response.json({ error: err.message }, { status });
  }

  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
