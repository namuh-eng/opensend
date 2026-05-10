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
import { NextResponse } from "next/server";

const suppressionService = createSuppressionService();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);

  try {
    const deleted = await suppressionService.deleteSuppression(
      userId,
      decodedEmail,
    );
    return NextResponse.json(deleted);
  } catch (err) {
    if (err instanceof SuppressionServiceError && err.code === "not_found") {
      return NextResponse.json(
        { error: "Suppression not found", code: "not_found" },
        { status: 404 },
      );
    }
    throw err;
  }
}
