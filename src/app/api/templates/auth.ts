import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";

type TemplateRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

type TemplateRouteAuthResult =
  | { ok: true; userId?: string }
  | { ok: false; response: Response };

async function getRouteUserId(auth: TemplateRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function authorizeTemplateRoute(
  authHeader: string | null | undefined,
): Promise<TemplateRouteAuthResult> {
  const auth = await authorizeDashboardOrApiKey(authHeader);
  if (!auth) return { ok: false, response: unauthorizedResponse() };

  if ("apiKeyId" in auth) {
    const permissionError = requireFullAccessApiKey(auth);
    if (permissionError) return { ok: false, response: permissionError };
  }

  if ("apiKeyId" in auth) {
    return auth.userId
      ? { ok: true, userId: auth.userId }
      : { ok: false, response: unauthorizedResponse() };
  }

  const userId = await getRouteUserId(auth);
  return userId ? { ok: true, userId } : { ok: true };
}
