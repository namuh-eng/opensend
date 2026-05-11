import { queueEvent } from "@/lib/events";
import { verifyEmailTrackingToken } from "@opensend/core";
import { findTrackingContext, getRequestMetadata } from "../../tracking-route";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const payload = verifyEmailTrackingToken(token);
  if (!payload || payload.kind !== "click" || !payload.targetUrl) {
    return new Response("Not found", { status: 404 });
  }

  let target: URL;
  try {
    target = new URL(payload.targetUrl);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response("Not found", { status: 404 });
  }

  const context = await findTrackingContext(payload);
  if (!context) return new Response("Not found", { status: 404 });

  await queueEvent({
    type: "email.clicked",
    userId: payload.userId,
    emailId: payload.emailId,
    payload: {
      email_id: payload.emailId,
      domain_id: payload.domainId,
      recipient: payload.recipient ?? null,
      url: target.toString(),
      ...getRequestMetadata(request),
    },
  });

  return Response.redirect(target.toString(), 302);
}
