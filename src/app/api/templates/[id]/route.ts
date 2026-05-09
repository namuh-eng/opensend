import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { extractTemplateVariables } from "@/lib/templates/parser";
import {
  normalizeStoredTemplateVariables,
  normalizeTemplateVariablesInput,
  templateVariableResponse,
} from "@/lib/templates/variables";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
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
      variables: normalizeStoredTemplateVariables(template.variables).map(
        (variable, index) =>
          templateVariableResponse(variable, index, {
            createdAt: template.createdAt,
          }),
      ),
      created_at: template.createdAt,
      updated_at: template.createdAt,
    });
  } catch (error) {
    console.error("Failed to fetch template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.alias !== undefined) updateData.alias = body.alias;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.from !== undefined) updateData.from = body.from;
    if (body.replyTo !== undefined) updateData.replyTo = body.replyTo;
    if (body.previewText !== undefined)
      updateData.previewText = body.previewText;
    if (body.html !== undefined) updateData.html = body.html;
    if (body.text !== undefined) updateData.text = body.text;

    // Automatic variable extraction if html or subject is updated
    if (body.html !== undefined || body.subject !== undefined) {
      const existing = await db.query.templates.findFirst({
        where: eq(templates.id, id),
      });

      if (existing) {
        const fullContent = `${body.subject ?? existing.subject ?? ""} ${body.html ?? existing.html ?? ""} ${body.text ?? existing.text ?? ""}`;
        const extracted = extractTemplateVariables(fullContent);

        // Merge with existing manual variable requirements if they exist
        const currentVars = normalizeStoredTemplateVariables(
          existing.variables,
        );
        const varMap = new Map(
          currentVars.map((variable) => [variable.key, variable]),
        );

        updateData.variables = extracted.map((name) => ({
          name,
          key: name,
          type: varMap.get(name)?.type ?? "string",
          required: varMap.get(name)?.required ?? false,
          fallbackValue: varMap.get(name)?.fallbackValue ?? null,
        }));
      }
    }

    // Manual variable override
    if (body.variables !== undefined) {
      const variableResult = normalizeTemplateVariablesInput(body.variables);
      if (!variableResult.ok) {
        return NextResponse.json(
          { error: variableResult.error },
          { status: 422 },
        );
      }
      updateData.variables = variableResult.variables;
    }

    const [updated] = await db
      .update(templates)
      .set(updateData)
      .where(eq(templates.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      object: "template",
      id: updated.id,
      name: updated.name,
      alias: updated.alias,
      status: updated.status,
      subject: updated.subject,
      from: updated.from,
      reply_to: updated.replyTo,
      preview_text: updated.previewText,
      html: updated.html,
      text: updated.text,
      variables: normalizeStoredTemplateVariables(updated.variables).map(
        (variable, index) =>
          templateVariableResponse(variable, index, {
            createdAt: updated.createdAt,
          }),
      ),
      created_at: updated.createdAt,
      updated_at: updated.createdAt,
    });
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 },
    );
  }
}
