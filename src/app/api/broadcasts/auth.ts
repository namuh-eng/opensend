import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";

type BroadcastRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function getUserIdFromAuth(
  auth: BroadcastRouteAuth,
): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function resolveBroadcastRouteUserId(
  authHeader: string | null | undefined,
): Promise<string | Response> {
  const auth = await authorizeDashboardOrApiKey(authHeader);
  if (!auth) return unauthorizedResponse();

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  return (await getUserIdFromAuth(auth)) ?? unauthorizedResponse();
}
