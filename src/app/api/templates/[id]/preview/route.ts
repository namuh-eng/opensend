import {
  StoredTemplateRendererConfigError,
  TemplatePreviewServiceError,
  createTemplatePreviewService,
} from "@/lib/templates/preview-service";
import { TemplateRendererError } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeTemplateRoute } from "../../auth";

function previewErrorResponse(error: unknown) {
  if (error instanceof TemplatePreviewServiceError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (
    error instanceof TemplateRendererError ||
    error instanceof StoredTemplateRendererConfigError
  ) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  console.error("Failed to render template preview:", error);
  return NextResponse.json(
    { error: "Failed to render template preview" },
    { status: 500 },
  );
}

function templatePreviewService() {
  return createTemplatePreviewService();
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
    const preview = await templatePreviewService().renderPreview(id, {
      userId: auth.userId,
    });

    return NextResponse.json(preview);
  } catch (error) {
    return previewErrorResponse(error);
  }
}
