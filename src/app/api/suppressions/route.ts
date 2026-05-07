import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { listSuppressions, serializeSuppression } from "@/lib/suppressions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit")) || 50),
  );
  const after = url.searchParams.get("after") || undefined;

  const result = await listSuppressions({ userId, limit, after });

  return NextResponse.json({
    object: "list",
    scope: "user",
    data: result.data.map(serializeSuppression),
    has_more: result.hasMore,
  });
}
