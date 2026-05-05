import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { eq } from "drizzle-orm";

function pageHtml(status: "success" | "error", message: string): string {
  const title =
    status === "success" ? "Unsubscribed successfully" : "Something went wrong";
  const color = status === "success" ? "#10b981" : "#ef4444";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · OpenSend</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #fff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(28rem, calc(100vw - 3rem)); background: #1a1a1a; border: 1px solid rgba(255,255,255,.08); border-radius: 1rem; padding: 2rem; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
    .icon { width: 3rem; height: 3rem; border-radius: 999px; margin: 0 auto 1rem; display: grid; place-items: center; color: ${color}; border: 2px solid ${color}; font-weight: 700; }
    h1 { margin: 0 0 1rem; font-size: 1.25rem; }
    p { color: #a1a1aa; line-height: 1.5; margin: 0; font-size: .875rem; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,.04); color: #52525b; font-size: .625rem; text-transform: uppercase; letter-spacing: .16em; font-weight: 600; }
  </style>
</head>
<body>
  <main data-testid="unsubscribe-${status}">
    <div class="icon" aria-hidden="true">${status === "success" ? "✓" : "!"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <footer>Powered by OpenSend</footer>
  </main>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function markUnsubscribed(contactId: string, token: string | null) {
  if (!verifyUnsubscribeToken(contactId, token)) {
    return { ok: false as const, status: 404 };
  }

  const [updated] = await db
    .update(contacts)
    .set({ unsubscribed: true })
    .where(eq(contacts.id, contactId))
    .returning({ id: contacts.id });

  if (!updated) return { ok: false as const, status: 404 };
  return { ok: true as const };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const result = await markUnsubscribed(contactId, token);

  if (!result.ok) {
    return htmlResponse(
      pageHtml(
        "error",
        "We couldn't process your unsubscribe request. Please use the latest link from your email or contact the sender.",
      ),
      result.status,
    );
  }

  return htmlResponse(
    pageHtml(
      "success",
      "You have been removed from this mailing list. You will no longer receive marketing emails from this sender.",
    ),
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
): Promise<Response> {
  const { contactId } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const result = await markUnsubscribed(contactId, token);
  return new Response(null, {
    status: result.ok ? 202 : result.status,
    headers: { "Cache-Control": "no-store" },
  });
}
