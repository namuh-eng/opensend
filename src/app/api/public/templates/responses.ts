import {
  type TemplateDetail,
  type TemplateListItem,
  TemplateServiceError,
} from "@opensend/core";
import { NextResponse } from "next/server";

export function mapTemplateError(error: unknown, fallback: string) {
  if (error instanceof TemplateServiceError) {
    const status =
      error.code === "not_found" ? 404 : error.code === "not_draft" ? 400 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function templateListItemResponse(template: TemplateListItem) {
  return {
    object: "template" as const,
    id: template.id,
    name: template.name,
    alias: template.alias,
    status: template.status,
    current_version_id: template.currentVersionId,
    published_at: template.publishedAt,
    has_unpublished_versions: template.hasUnpublishedVersions,
    created_at: template.createdAt,
  };
}

export function templateDetailResponse(template: TemplateDetail) {
  return {
    object: "template" as const,
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

export function templateMutationResponse(id: string) {
  return { object: "template" as const, id };
}
