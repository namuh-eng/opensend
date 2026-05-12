import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  SuppressionServiceError,
  createSuppressionService,
} from "@opensend/core";

const suppressionService = createSuppressionService();

type SuppressionAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

async function requireSuppressionAuth(
  request: Request,
): Promise<SuppressionAuthResult> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { ok: false, response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { ok: false, response: permissionError };

  if ("userId" in auth) {
    if (!auth.userId) return { ok: false, response: unauthorizedResponse() };
    return { ok: true, userId: auth.userId };
  }

  const session = await getServerSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, response: unauthorizedResponse() };

  return { ok: true, userId };
}

export async function handleListSuppressionsRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit"));
  const after = url.searchParams.get("after") || undefined;

  const result = await suppressionService.listSuppressions({
    userId: authResult.userId,
    limit,
    after,
  });

  return Response.json(result);
}

export async function handleDeleteSuppressionRequest(
  request: Request,
  email: string,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const decodedEmail = decodeURIComponent(email);

  try {
    const deleted = await suppressionService.deleteSuppression(
      authResult.userId,
      decodedEmail,
    );
    return Response.json(deleted);
  } catch (err) {
    if (err instanceof SuppressionServiceError && err.code === "not_found") {
      return Response.json(
        { error: "Suppression not found", code: "not_found" },
        { status: 404 },
      );
    }
    throw err;
  }
}
