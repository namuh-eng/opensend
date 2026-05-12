import { createTemplateService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";
import { authorizePublicTemplateRoute } from "./auth";
import {
  mapTemplateError,
  templateListItemResponse,
  templateMutationResponse,
} from "./responses";

function templateService() {
  return createTemplateService();
}

export async function GET(request: NextRequest) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await templateService().listTemplates({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      limit: Number(request.nextUrl.searchParams.get("limit")) || undefined,
      after: request.nextUrl.searchParams.get("after") ?? undefined,
      userId: auth.auth.userId,
    });

    return NextResponse.json({
      object: "list",
      data: result.data.map(templateListItemResponse),
      has_more: result.hasMore,
    });
  } catch (error) {
    return mapTemplateError(error, "Failed to fetch templates");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizePublicTemplateRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const created = await templateService().createTemplate(
      await request.json(),
      { userId: auth.auth.userId },
    );

    return NextResponse.json(templateMutationResponse(created.id), {
      status: 201,
    });
  } catch (error) {
    return mapTemplateError(error, "Failed to create template");
  }
}
