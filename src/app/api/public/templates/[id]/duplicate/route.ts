import { createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizePublicTemplateRoute } from "../../auth";
import { mapTemplateError, templateMutationResponse } from "../../responses";

function templateService() {
  return createTemplateService();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const duplicated = await templateService().duplicateTemplate(id, {
      userId: auth.auth.userId,
    });
    return NextResponse.json(templateMutationResponse(duplicated.id));
  } catch (error) {
    return mapTemplateError(error, "Failed to duplicate template");
  }
}
