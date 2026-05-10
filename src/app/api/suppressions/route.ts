import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { createSuppressionService } from "@opensend/core";
import { NextResponse } from "next/server";

const suppressionService = createSuppressionService();

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
  const limit = Number(url.searchParams.get("limit"));
  const after = url.searchParams.get("after") || undefined;

  const result = await suppressionService.listSuppressions({
    userId,
    limit,
    after,
  });

  return NextResponse.json(result);
}
