import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { removeSuppression } from "@/lib/suppressions";
import { NextResponse } from "next/server";

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
  const removed = await removeSuppression({
    userId,
    email: decodedEmail,
  });

  if (!removed) {
    return NextResponse.json(
      { error: "Suppression not found", code: "not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ object: "suppression", deleted: true });
}
