import { authorizeDashboardOrApiKey, getServerSession } from "@/lib/api-auth";

type WebhookRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function getUserIdFromAuth(
  auth: WebhookRouteAuth,
): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

export async function resolveWebhookRouteUserId(
  authHeader: string | null | undefined,
): Promise<string | null> {
  const auth = await authorizeDashboardOrApiKey(authHeader);
  if (!auth) return null;

  return getUserIdFromAuth(auth);
}
