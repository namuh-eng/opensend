import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";

type AutomationRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function getUserIdFromAuth(
  auth: AutomationRouteAuth,
): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function authorizeAutomationRoute(
  request: Request,
): Promise<{ userId: string } | { response: Response }> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { response: permissionError };

  const userId = await getUserIdFromAuth(auth);
  if (!userId) return { response: unauthorizedResponse() };

  return { userId };
}
