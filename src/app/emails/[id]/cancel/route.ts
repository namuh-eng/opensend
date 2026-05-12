import { POST as cancelEmail } from "@/app/api/emails/[id]/cancel/route";
import type { NextRequest } from "next/server";

type CancelEmailAliasContext = {
  params: Promise<{ id: string }>;
};

function getCanceledEmailId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

export async function POST(
  request: NextRequest,
  context: CancelEmailAliasContext,
): Promise<Response> {
  const { id } = await context.params;
  const response = await cancelEmail(request, {
    params: Promise.resolve({ id }),
  });

  if (!response.ok) {
    return response;
  }

  const canceledId = getCanceledEmailId((await response.json()) as unknown);
  if (!canceledId) {
    return Response.json({ error: "Failed to cancel email" }, { status: 500 });
  }

  return Response.json({ object: "email", id: canceledId });
}
