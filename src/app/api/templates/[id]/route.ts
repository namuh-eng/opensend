import {
  type TemplateDetail,
  TemplateServiceError,
  createTemplateService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeTemplateRoute } from "../auth";

function mapTemplateError(error: unknown, fallback: string) {
  if (error instanceof TemplateServiceError) {
    const status = error.code === "not_found" ? 404 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function templateService() {
  return createTemplateService();
}

function templateResponse(template: TemplateDetail) {
  return {
    object: "template",
    id: template.id,
    name: template.name,
    alias: template.alias,
    status: template.status,
    subject: template.subject,
    from: template.from,
    reply_to: template.replyTo,
    preview_text: template.previewText,
    html: template.html,
    text: template.text,
    variables: template.variables,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await templateService().getTemplate(id, {
      userId: auth.userId,
    });
    return NextResponse.json(templateResponse(template));
  } catch (error) {
    return mapTemplateError(error, "Failed to fetch template");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const updated = await templateService().updateTemplate(
      id,
      await request.json(),
      { userId: auth.userId },
    );

    return NextResponse.json(templateResponse(updated));
  } catch (error) {
    return mapTemplateError(error, "Failed to update template");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await templateService().deleteTemplate(id, { userId: auth.userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return mapTemplateError(error, "Failed to delete template");
  }
}
