import { TemplateServiceError, createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeTemplateRoute } from "./auth";

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

export async function GET(request: NextRequest) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const result = await templateService().listTemplates({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      userId: auth.userId,
    });

    return NextResponse.json({
      object: "list",
      data: result.data.map((r) => ({
        id: r.id,
        name: r.name,
        alias: r.alias,
        status: r.status,
        current_version_id: r.currentVersionId,
        published_at: r.publishedAt,
        has_unpublished_versions: r.hasUnpublishedVersions,
        created_at: r.createdAt,
      })),
      total: result.total,
    });
  } catch (error) {
    return mapTemplateError(error, "Failed to fetch templates");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeTemplateRoute(
    request.headers.get("authorization"),
  );
  if (!auth.ok) return auth.response;

  try {
    const created = await templateService().createTemplate(
      await request.json(),
      { userId: auth.userId },
    );

    return NextResponse.json(
      {
        object: "template",
        id: created.id,
        name: created.name,
        alias: created.alias,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapTemplateError(error, "Failed to create template");
  }
}
