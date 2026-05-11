import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { TemplateServiceError, createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const duplicated = await templateService().duplicateTemplate(id);

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
