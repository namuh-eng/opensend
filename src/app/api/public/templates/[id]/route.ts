import { createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizePublicTemplateRoute } from "../auth";
import {
  mapTemplateError,
  templateDetailResponse,
  templateMutationResponse,
} from "../responses";

function templateService() {
  return createTemplateService();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await templateService().getTemplate(id, {
      userId: auth.auth.userId,
    });
    return NextResponse.json(templateDetailResponse(template));
  } catch (error) {
    return mapTemplateError(error, "Failed to fetch template");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const updated = await templateService().updateTemplate(
      id,
      await request.json(),
      { userId: auth.auth.userId },
    );
    return NextResponse.json(templateMutationResponse(updated.id));
  } catch (error) {
    return mapTemplateError(error, "Failed to update template");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await templateService().getTemplate(id, {
      userId: auth.auth.userId,
    });
    await templateService().deleteTemplate(id, { userId: auth.auth.userId });
    return NextResponse.json({
      object: "template",
      id: template.id,
      deleted: true,
    });
  } catch (error) {
    return mapTemplateError(error, "Failed to delete template");
  }
}
