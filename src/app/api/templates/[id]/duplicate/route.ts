import { TemplateServiceError, createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeTemplateRoute } from "../../auth";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const duplicated = await templateService().duplicateTemplate(id, {
      userId: auth.userId,
    });

    return NextResponse.json({
      object: "template",
      id: duplicated.id,
      name: duplicated.name,
      status: duplicated.status,
    });
  } catch (error) {
    return mapTemplateError(error, "Failed to duplicate template");
  }
}
