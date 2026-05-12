import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import {
  StoredTemplateRendererConfigError,
  getStoredTemplateRendererConfig,
  renderStoredTemplateContent,
  resolveStoredTemplateRenderVariables,
} from "@/lib/templates/stored-renderer";
import { TemplateRendererError } from "@opensend/core";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeTemplateRoute } from "../../auth";

function previewErrorResponse(error: unknown) {
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
    const template = await db.query.templates.findFirst({
      where: auth.userId
        ? and(eq(templates.id, id), eq(templates.userId, auth.userId))
        : eq(templates.id, id),
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    const rendererConfig = getStoredTemplateRendererConfig(template.document);
    const variableResult = resolveStoredTemplateRenderVariables({
      storedVariables: template.variables,
      mode: "preview",
    });
    const storedSubject =
      typeof template.subject === "string" && template.subject.length > 0
        ? template.subject
        : null;
    const rendered = await renderStoredTemplateContent({
      template,
      subject:
        storedSubject ??
        (rendererConfig.kind === "legacy"
          ? (template.subject ?? "")
          : undefined),
      variables: variableResult.variables,
    });

    return NextResponse.json({
      object: "template_preview",
      id: template.id,
      rendering: {
        kind: rendererConfig.kind,
        template_key:
          rendererConfig.kind === "react_email"
            ? rendererConfig.templateKey
            : null,
      },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      variables: variableResult.resolutions,
      warnings: variableResult.warnings,
    });
  } catch (error) {
    return previewErrorResponse(error);
  }
}
