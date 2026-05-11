import { queueEvent } from "@/lib/events";
import { verifyEmailTrackingToken } from "@opensend/core";
import { findTrackingContext, getRequestMetadata } from "../../tracking-route";

export const runtime = "nodejs";

const TRANSPARENT_GIF = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33,
  249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

function pixelResponse(status = 200): Response {
  return new Response(TRANSPARENT_GIF, {
    status,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const payload = verifyEmailTrackingToken(token);
  if (!payload || payload.kind !== "open") return pixelResponse(404);

  const context = await findTrackingContext(payload);
  if (!context) return pixelResponse(404);

  await queueEvent({
    type: "email.opened",
    userId: payload.userId,
    emailId: payload.emailId,
    payload: {
      email_id: payload.emailId,
      domain_id: payload.domainId,
      recipient: payload.recipient ?? null,
      ...getRequestMetadata(request),
    },
  });

  return pixelResponse();
}
